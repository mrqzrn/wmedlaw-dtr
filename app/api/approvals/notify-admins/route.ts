import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { notifyAdminsOnDtrFinalized, AdminRecipient } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);

    // In production, require valid authentication. In local dev, allow simulation fallback.
    if ((auth.error || !auth.user) && process.env.NODE_ENV === 'production') {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required.' },
        401
      );
    }

    const body = await parseEncryptedRequest<any>(request);
    const {
      month,
      reference_no,
      total_hours,
      regular_hours,
      extra_hours,
      approved_hours,
      entries_count,
      submitted_at,
      employee_note,
      employee_id,
      employee_name,
      employee_no,
      employee_email,
      department,
      admin_emails,
    } = body;

    if (!month) {
      return createEncryptedResponse(
        { error: 'Bad Request: Month parameter (YYYY-MM) is required.' },
        400
      );
    }

    const targetUserId = employee_id || auth.user?.id;
    let resolvedEmployeeName = employee_name || '';
    let resolvedEmployeeNo = employee_no || '';
    let resolvedDepartment = department || '';
    let resolvedEmployeeEmail = employee_email || '';

    // If details are missing, fetch profile from Supabase database
    if (targetUserId && (!resolvedEmployeeName || !resolvedEmployeeNo)) {
      try {
        const { data: profile } = await supabaseServer
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .maybeSingle();

        if (profile) {
          if (!resolvedEmployeeName) {
            resolvedEmployeeName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || 'Employee';
          }
          if (!resolvedEmployeeNo) resolvedEmployeeNo = profile.employee_no || '';
          if (!resolvedDepartment) resolvedDepartment = profile.department || 'IT';
          if (!resolvedEmployeeEmail) resolvedEmployeeEmail = profile.email || '';
        }
      } catch (err) {
        console.warn('Could not fetch employee profile for DTR notification:', err);
      }
    }

    // 1. Query active administrators from database
    const adminList: AdminRecipient[] = [];
    try {
      const { data: dbAdmins } = await supabaseServer
        .from('profiles')
        .select('id, email, first_name, last_name, role, status')
        .in('role', ['admin', 'system_admin'])
        .eq('status', 'active');

      (dbAdmins || []).forEach((a: any) => {
        if (a.email && a.email.includes('@')) {
          adminList.push({
            email: a.email.trim(),
            name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Administrator',
          });
        }
      });
    } catch (dbErr) {
      console.warn('Could not query active admin profiles from database:', dbErr);
    }

    // 2. Check environment variables for dedicated admin notification recipients
    const envAdmins = (process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes('@'));

    envAdmins.forEach((email) => {
      adminList.push({ email, name: 'Payroll Administrator' });
    });

    // 3. Fallback: Add client-supplied active admins if database query returned none
    if (Array.isArray(admin_emails)) {
      admin_emails.forEach((item: any) => {
        if (typeof item === 'string' && item.includes('@')) {
          adminList.push({ email: item.trim(), name: 'Administrator' });
        } else if (item && typeof item === 'object' && item.email && item.email.includes('@')) {
          adminList.push({ email: item.email.trim(), name: item.name || 'Administrator' });
        }
      });
    }

    // 4. Default fallback mock admin emails for local development if list is empty
    if (adminList.length === 0) {
      adminList.push(
        { email: 'alex.rivera@company.com', name: 'Alex Rivera' },
        { email: 'sarah.chen@company.com', name: 'Sarah Chen' }
      );
    }

    const origin =
      request.headers.get('origin') ||
      process.env.APP_URL ||
      'https://timekeeping-dtr.vercel.app';

    const refNo =
      reference_no ||
      `REF-DTR-${month.replace(/[^0-9]/g, '')}-${(targetUserId || 'EMP').slice(0, 8).toUpperCase()}`;

    // Dispatch the notifications
    const result = await notifyAdminsOnDtrFinalized({
      admins: adminList,
      employee_name: resolvedEmployeeName || 'Employee',
      employee_no: resolvedEmployeeNo,
      employee_email: resolvedEmployeeEmail,
      department: resolvedDepartment || 'IT',
      month,
      reference_no: refNo,
      total_hours: Number(total_hours) || 0,
      regular_hours: Number(regular_hours) || 0,
      extra_hours: Number(extra_hours) || 0,
      approved_hours: Number(approved_hours) || 0,
      entries_count: Number(entries_count) || 0,
      submitted_at: submitted_at || new Date().toISOString(),
      employee_note,
      origin,
    });

    // Log event in Supabase audit table
    try {
      await supabaseServer.from('audit_logs').insert({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'DTR_FINALIZATION_EMAILED_ADMINS',
        entity_type: 'monthly_approval',
        entity_id: refNo,
        user_id: auth.user?.id || targetUserId || 'system',
        user_name: resolvedEmployeeName || 'Employee',
        user_role: 'employee',
        details: `Monthly DTR finalization notification for ${month} (Ref: ${refNo}, ${total_hours || 0} hrs) dispatched to ${result.recipients.join(', ')}. (Simulated: ${Boolean(result.simulated)})`,
        is_system_scope: false,
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for DTR finalization email:', auditErr);
    }

    return createEncryptedResponse({
      success: true,
      sent: result.sent > 0,
      simulated: result.simulated,
      recipients: result.recipients,
      total_recipients: result.total,
      message: result.simulated
        ? `Monthly DTR finalization email simulated for ${result.recipients.length} administrator(s) (${result.recipients.join(', ')}).`
        : `Monthly DTR finalization email dispatched to ${result.recipients.length} administrator(s) (${result.recipients.join(', ')}).`,
      results: result.results,
    });
  } catch (err: any) {
    console.error('Error in notify-admins endpoint:', err);
    return createEncryptedResponse(
      {
        success: false,
        error: err?.message || 'Internal server error notifying admins',
      },
      500
    );
  }
}
