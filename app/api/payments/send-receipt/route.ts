import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { sendDisbursementReceipt, DisbursementEmailParams } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);

    // In production, require valid authentication. In local dev, allow simulation / dev fallback.
    if ((auth.error || !auth.user) && process.env.NODE_ENV === 'production') {
      return createEncryptedResponse(
        { error: 'Unauthorized: Authentication required.' },
        401
      );
    }

    if (!auth.isAdmin && auth.user && process.env.NODE_ENV === 'production') {
      return createEncryptedResponse(
        { error: 'Forbidden: Administrator privileges required to dispatch payment receipts.' },
        403
      );
    }

    const body = await parseEncryptedRequest<any>(request);
    const {
      payment_id,
      user_id,
      email,
      employee_name,
      employee_no,
      department,
      hourly_rate,
      gross_amount,
      total_hours,
      method,
      reference_no,
      paid_at,
      bank_name,
      account_no,
      pay_period_label,
      lines,
    } = body;

    let targetEmail = (email || '').trim();
    let targetName = employee_name || '';
    let targetDept = department || '';
    let targetHourlyRate = hourly_rate;
    let targetBankName = bank_name;
    let targetAccountNo = account_no;
    let targetGrossAmount = gross_amount;
    let targetTotalHours = total_hours;
    let targetLines = lines;
    let targetMethod = method;
    let targetRefNo = reference_no;
    let targetPaidAt = paid_at;

    // If target email or details are missing, fetch profile and payment from Supabase database
    const resolvedUserId = user_id || null;

    if ((!targetEmail || !targetName) && (resolvedUserId || payment_id)) {
      if (resolvedUserId) {
        const { data: profile } = await supabaseServer
          .from('profiles')
          .select('*')
          .eq('id', resolvedUserId)
          .maybeSingle();

        if (profile) {
          if (!targetEmail) targetEmail = (profile.email || '').trim();
          if (!targetName) targetName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username || 'Employee';
          if (!targetDept) targetDept = profile.department || 'IT';
          if (targetHourlyRate === undefined) targetHourlyRate = profile.hourly_rate;
          if (!targetBankName) targetBankName = profile.bank_name;
          if (!targetAccountNo) targetAccountNo = profile.account_no;
        }
      }

      if (payment_id && (!targetEmail || !targetName || targetGrossAmount === undefined || !targetLines)) {
        const { data: payRecord } = await supabaseServer
          .from('payments')
          .select('*')
          .eq('id', payment_id)
          .maybeSingle();

        if (payRecord) {
          if (targetGrossAmount === undefined) targetGrossAmount = Number(payRecord.gross_amount) || 0;
          if (targetTotalHours === undefined) targetTotalHours = Number(payRecord.total_hours) || 0;
          if (!targetLines && Array.isArray(payRecord.lines)) targetLines = payRecord.lines;
          if (!targetMethod) targetMethod = payRecord.method;
          if (!targetRefNo) targetRefNo = payRecord.reference_no;
          if (!targetPaidAt) targetPaidAt = payRecord.paid_at;

          // If still no email, check user_id on payment record
          if ((!targetEmail || !targetName) && payRecord.user_id) {
            const { data: profile } = await supabaseServer
              .from('profiles')
              .select('*')
              .eq('id', payRecord.user_id)
              .maybeSingle();

            if (profile) {
              if (!targetEmail) targetEmail = (profile.email || '').trim();
              if (!targetName) targetName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Employee';
              if (!targetDept) targetDept = profile.department || 'IT';
              if (targetHourlyRate === undefined) targetHourlyRate = profile.hourly_rate;
              if (!targetBankName) targetBankName = profile.bank_name;
              if (!targetAccountNo) targetAccountNo = profile.account_no;
            }
          }
        }
      }
    }

    if (!targetEmail) {
      return createEncryptedResponse(
        {
          success: false,
          error: 'No recipient email address could be resolved for this employee.',
        },
        400
      );
    }

    const emailParams: DisbursementEmailParams = {
      to: targetEmail,
      employee_name: targetName || 'Valued Employee',
      employee_no,
      department: targetDept,
      hourly_rate: targetHourlyRate,
      gross_amount: Number(targetGrossAmount) || 0,
      total_hours: Number(targetTotalHours) || 0,
      method: targetMethod || 'bank_transfer',
      reference_no: targetRefNo || 'PAID',
      paid_at: targetPaidAt || new Date().toISOString().slice(0, 10),
      bank_name: targetBankName,
      account_no: targetAccountNo,
      pay_period_label,
      lines: Array.isArray(targetLines) ? targetLines : undefined,
      origin: request.headers.get('origin') || process.env.APP_URL || 'https://timekeeping-dtr.vercel.app',
    };

    const result = await sendDisbursementReceipt(emailParams);

    // If live sending failed, return an error response
    if (!result.sent) {
      return createEncryptedResponse(
        {
          success: false,
          sent: false,
          simulated: false,
          error: result.error || result.reason || 'Failed to dispatch email via email provider.',
        },
        500
      );
    }

    // Optional: Log receipt dispatch event in audit table with correct column names (actor_id, actor_name, actor_role)
    try {
      await supabaseServer.from('audit_logs').insert({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'PAYMENT_RECEIPT_EMAILED',
        entity_type: 'payment',
        entity_id: payment_id || 'manual',
        actor_id: auth.user?.id || 'admin',
        actor_name: `${auth.user?.first_name || ''} ${auth.user?.last_name || ''}`.trim() || auth.profile?.username || 'Admin',
        actor_role: auth.user?.role || auth.profile?.role || 'admin',
        details: `Disbursement receipt for Ref "${emailParams.reference_no}" (${emailParams.gross_amount}) dispatched to ${targetEmail}. (Simulated: ${Boolean(result.simulated)})`,
        is_system_scope: false,
        created_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('Failed to insert audit log for receipt email:', auditErr);
    }

    return createEncryptedResponse({
      success: true,
      sent: result.sent,
      simulated: result.simulated ?? false,
      recipient: targetEmail,
      message: result.simulated
        ? `Disbursement confirmation receipt logged in simulation mode for ${targetEmail}.`
        : `Disbursement confirmation receipt sent to ${targetEmail}.`,
    });
  } catch (err: any) {
    console.error('Error dispatching disbursement receipt email:', err);
    return createEncryptedResponse(
      {
        success: false,
        error: err?.message || 'Internal server error dispatching email receipt',
      },
      500
    );
  }
}
