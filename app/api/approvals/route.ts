import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { notifyAdminsOnDtrFinalized } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required.' },
        401
      );
    }

    let query = supabaseServer
      .from('monthly_self_approvals')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (!auth.isAdmin) {
      query = query.eq('user_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query monthly_self_approvals:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, approvals: [] }, 400);
    }

    const mappedApprovals = (data || []).map((a: any) => {
      const refMatch = a.employee_note?.match(/\[REF:(.*?)\]/);
      const cleanRef = a.reference_no || (refMatch ? refMatch[1] : `REF-DTR-${(a.month || '').replace(/[^0-9]/g, '')}-${(a.user_id || '').slice(0, 8).toUpperCase()}`);
      return {
        ...a,
        reference_no: cleanRef,
      };
    });

    return createEncryptedResponse({
      success: true,
      approvals: mappedApprovals,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch monthly approvals' },
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required.' },
        401
      );
    }

    const body = await parseEncryptedRequest<any>(request);
    const item = body.approval || body;

    if (!auth.isAdmin && item.user_id !== auth.user.id) {
      return createEncryptedResponse(
        { error: 'Forbidden: You cannot submit approvals for other employees.' },
        403
      );
    }

    const refMatch = item.employee_note?.match(/\[REF:(.*?)\]/);
    const refTag = item.reference_no || (refMatch ? refMatch[1] : `REF-DTR-${(item.month || '').replace(/[^0-9]/g, '')}-${(item.user_id || '').slice(0, 8).toUpperCase()}`);
    let finalNote = (item.employee_note || '').trim();
    if (!finalNote.includes(`[REF:${refTag}]`)) {
      finalNote = `[REF:${refTag}] ${finalNote}`.trim();
    }

    const payload: any = {
      id: item.id || `appr-${item.user_id}-${item.month}`,
      user_id: item.user_id,
      month: item.month,
      total_hours: Number(item.total_hours) || 0,
      regular_hours: Number(item.regular_hours) || 0,
      extra_hours: Number(item.extra_hours) || 0,
      approved_hours: Number(item.approved_hours) || 0,
      entries_count: Number(item.entries_count) || 0,
      submitted_at: item.submitted_at || new Date().toISOString(),
      employee_note: finalNote || null,
      attested: item.attested !== undefined ? Boolean(item.attested) : true,
      status: item.status || 'submitted',
      reviewed_by_name: item.reviewed_by_name || null,
      reviewed_at: item.reviewed_at || null,
      reference_no: refTag,
    };

    let { data, error } = await supabaseServer
      .from('monthly_self_approvals')
      .upsert(payload)
      .select()
      .single();

    if (error && error.message.includes('column')) {
      delete payload.reference_no;
      const retry = await supabaseServer
        .from('monthly_self_approvals')
        .upsert(payload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    // Auto-dispatch email notification to administrators if requested or newly submitted
    let emailDispatchResult: any = null;
    if (body.notify_admins && payload.status === 'submitted') {
      try {
        const { data: dbAdmins } = await supabaseServer
          .from('profiles')
          .select('id, email, first_name, last_name, role, status')
          .in('role', ['admin', 'system_admin'])
          .eq('status', 'active');

        const adminList: any[] = [];
        (dbAdmins || []).forEach((a: any) => {
          if (a.email && a.email.includes('@')) {
            adminList.push({
              email: a.email.trim(),
              name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Administrator',
            });
          }
        });

        const envAdmins = (process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAIL || '')
          .split(/[,;]/)
          .map((e) => e.trim())
          .filter((e) => e && e.includes('@'));
        envAdmins.forEach((email) => adminList.push({ email, name: 'Payroll Administrator' }));

        if (Array.isArray(body.admin_emails)) {
          body.admin_emails.forEach((item: any) => {
            if (typeof item === 'string' && item.includes('@')) {
              adminList.push({ email: item.trim(), name: 'Administrator' });
            } else if (item && typeof item === 'object' && item.email && item.email.includes('@')) {
              adminList.push({ email: item.email.trim(), name: item.name || 'Administrator' });
            }
          });
        }

        if (adminList.length > 0) {
          const origin = request.headers.get('origin') || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app';
          emailDispatchResult = await notifyAdminsOnDtrFinalized({
            admins: adminList,
            employee_name: body.employee_name || `${auth.profile?.first_name || ''} ${auth.profile?.last_name || ''}`.trim() || 'Employee',
            employee_no: body.employee_no || auth.profile?.employee_no,
            employee_email: body.employee_email || auth.user?.email,
            department: body.department || auth.profile?.department || 'IT',
            month: payload.month,
            reference_no: refTag,
            total_hours: payload.total_hours,
            regular_hours: payload.regular_hours,
            extra_hours: payload.extra_hours,
            approved_hours: payload.approved_hours,
            entries_count: payload.entries_count,
            submitted_at: payload.submitted_at,
            employee_note: payload.employee_note,
            origin,
          });
        }
      } catch (notifyErr) {
        console.warn('Auto admin notification in /api/approvals warning:', notifyErr);
      }
    }

    return createEncryptedResponse({
      success: true,
      approval: { ...(data || payload), reference_no: refTag },
      email_dispatched: Boolean(emailDispatchResult?.sent > 0),
      email_simulated: Boolean(emailDispatchResult?.simulated),
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert monthly approval' },
      500
    );
  }
}
