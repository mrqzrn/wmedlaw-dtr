import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { sendDtrFinalizeReminder } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export interface ReminderDispatchResult {
  user_id: string;
  name: string;
  email: string;
  success: boolean;
  simulated?: boolean;
  error?: string;
}

/**
 * POST /api/approvals/remind-employees
 * Admin-only. Emails employees who have not finalized (self-approved) their DTR for `month`,
 * asking them to review and finalize before the last day of the month.
 *
 * Body: { month?: 'YYYY-MM', today?: 'YYYY-MM-DD', user_ids?: string[] }
 *   - user_ids omitted → remind every active employee who has not finalized.
 *   - user_ids provided → remind only those employees (already-finalized ones are skipped).
 */
export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);

    if (auth.error || !auth.user) {
      return createEncryptedResponse({ error: 'Unauthorized: Authentication required.' }, 401);
    }
    if (!auth.isAdmin) {
      return createEncryptedResponse(
        { error: 'Forbidden: Administrator privileges required to send DTR reminders.' },
        403
      );
    }

    const body = (await parseEncryptedRequest<any>(request)) || {};
    const today: string =
      typeof body.today === 'string' && DATE_RE.test(body.today)
        ? body.today
        : new Date().toISOString().slice(0, 10);
    const month: string =
      typeof body.month === 'string' && MONTH_RE.test(body.month) ? body.month : today.slice(0, 7);
    const requestedIds: string[] | null = Array.isArray(body.user_ids)
      ? body.user_ids.filter((id: unknown) => typeof id === 'string' && id)
      : null;

    if (requestedIds && requestedIds.length === 0) {
      return createEncryptedResponse({ error: 'Bad Request: user_ids must not be empty.' }, 400);
    }

    const deadline = lastDayOfMonth(month);
    const daysRemaining = Math.max(0, daysBetween(today, deadline));

    // 1. Eligible employees: active, clock-in capable, not hidden system accounts
    const { data: profiles, error: profileErr } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('status', 'active');
    if (profileErr) {
      return createEncryptedResponse({ error: profileErr.message }, 400);
    }
    const eligible = (profiles || []).filter(
      (p: any) => (p.role === 'employee' || p.clocks_in) && !p.is_hidden
    );

    // 2. Who already finalized this month
    const { data: approvals, error: approvalErr } = await supabaseServer
      .from('monthly_self_approvals')
      .select('user_id')
      .eq('month', month);
    if (approvalErr) {
      return createEncryptedResponse({ error: approvalErr.message }, 400);
    }
    const finalizedIds = new Set((approvals || []).map((a: any) => a.user_id));

    const skipped: Array<{ user_id: string; reason: string }> = [];
    let targets = eligible.filter((p: any) => !finalizedIds.has(p.id));

    if (requestedIds) {
      const eligibleIds = new Set(eligible.map((p: any) => p.id));
      requestedIds.forEach((id) => {
        if (!eligibleIds.has(id)) skipped.push({ user_id: id, reason: 'not_eligible' });
        else if (finalizedIds.has(id)) skipped.push({ user_id: id, reason: 'already_finalized' });
      });
      const wanted = new Set(requestedIds);
      targets = targets.filter((p: any) => wanted.has(p.id));
    }

    if (targets.length === 0) {
      return createEncryptedResponse({
        success: true,
        month,
        deadline_date: deadline,
        total: 0,
        sent: 0,
        failed: 0,
        simulated: false,
        results: [],
        skipped,
        message: 'No employees need a reminder: everyone selected has already finalized.',
      });
    }

    // 3. Per-employee snapshot of what is logged so far this month
    const { data: entries } = await supabaseServer
      .from('dtr_entries')
      .select('user_id, hours, time_out, status')
      .gte('work_date', `${month}-01`)
      .lte('work_date', deadline)
      .in('user_id', targets.map((p: any) => p.id));

    const stats = new Map<string, { count: number; hours: number; open: number }>();
    (entries || []).forEach((e: any) => {
      if (e.status === 'rejected') return;
      const s = stats.get(e.user_id) || { count: 0, hours: 0, open: 0 };
      s.count += 1;
      s.hours += Number(e.hours) || 0;
      if (!e.time_out || e.status === 'open') s.open += 1;
      stats.set(e.user_id, s);
    });

    const senderName =
      `${auth.profile?.first_name || ''} ${auth.profile?.last_name || ''}`.trim() || 'Payroll Administration';
    const origin = request.headers.get('origin') || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';

    // 4. Dispatch
    const results: ReminderDispatchResult[] = [];
    for (const p of targets) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || 'Employee';
      const email = (p.email || '').trim();
      if (!email || !email.includes('@')) {
        results.push({ user_id: p.id, name, email, success: false, error: 'No email address on file' });
        continue;
      }
      const s = stats.get(p.id) || { count: 0, hours: 0, open: 0 };
      try {
        const res = await sendDtrFinalizeReminder({
          to: email,
          employee_name: name,
          employee_no: p.employee_no,
          department: p.department,
          month,
          deadline_date: deadline,
          days_remaining: daysRemaining,
          entries_count: s.count,
          total_hours: Math.round(s.hours * 100) / 100,
          open_sessions_count: s.open,
          sent_by_name: senderName,
          origin,
        });
        results.push({
          user_id: p.id,
          name,
          email,
          success: res.sent,
          simulated: res.simulated,
          error: res.sent ? undefined : res.error || res.reason || 'Delivery failed',
        });
      } catch (err: any) {
        results.push({ user_id: p.id, name, email, success: false, error: err?.message || 'Delivery failed' });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;
    const simulated = results.some((r) => r.simulated);

    // 5. Audit trail
    try {
      await supabaseServer.from('audit_logs').insert({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'DTR_FINALIZE_REMINDER_EMAILED',
        entity_type: 'monthly_approval',
        entity_id: month,
        actor_id: auth.user.id,
        actor_name: senderName,
        actor_role: auth.profile?.role || 'admin',
        details: `DTR finalization reminder for ${month} (deadline ${deadline}) sent to ${sent} of ${results.length} employee(s)${requestedIds ? ' (individual)' : ' (all pending)'}: ${results
          .filter((r) => r.success)
          .map((r) => r.email)
          .join(', ') || 'none'}.${failed > 0 ? ` Failed: ${results.filter((r) => !r.success).map((r) => `${r.name} (${r.error})`).join(', ')}.` : ''} (Simulated: ${simulated})`,
        is_system_scope: false,
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for DTR finalize reminder:', auditErr);
    }

    return createEncryptedResponse({
      success: true,
      month,
      deadline_date: deadline,
      total: results.length,
      sent,
      failed,
      simulated,
      results,
      skipped,
      message:
        failed === 0
          ? `Reminder ${simulated ? 'simulated' : 'sent'} to ${sent} employee(s).`
          : `Reminder sent to ${sent} of ${results.length} employee(s); ${failed} failed.`,
    });
  } catch (err: any) {
    console.error('Error in remind-employees endpoint:', err);
    return createEncryptedResponse(
      { success: false, error: err?.message || 'Internal server error sending DTR reminders' },
      500
    );
  }
}
