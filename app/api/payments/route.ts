import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';

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
      .from('payments')
      .select('*')
      .order('generated_at', { ascending: false });

    // Non-admins can only see their own payment records (only query valid UUIDs against PostgreSQL uuid column)
    if (!auth.isAdmin) {
      const isUuid = (val: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const candidates = [auth.user?.id, auth.profile?.id].filter(Boolean) as string[];
      const validUuids = Array.from(new Set(candidates.filter(isUuid)));
      if (validUuids.length > 0) {
        query = query.in('user_id', validUuids);
      } else {
        query = query.eq('user_id', auth.user.id);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query payments:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, payments: [] }, 400);
    }

    // Non-admins only receive their own records (filtered above by user_id = auth.user.id),
    // including their gross payable amount, wage breakdown lines, and disbursement status.
    const paymentsList = (data || []).map((p: any) => ({
      id: p.id,
      pay_period_id: p.pay_period_id,
      user_id: p.user_id,
      month: p.month,
      total_hours: Number(p.total_hours) || 0,
      sessions_count: Number(p.sessions_count) || 0,
      gross_amount: Number(p.gross_amount) || 0,
      status: p.status,
      method: p.method,
      reference_no: p.reference_no,
      status_reason: p.status_reason,
      paid_at: p.paid_at,
      generated_at: p.generated_at,
      updated_by_name: p.updated_by_name,
      lines: Array.isArray(p.lines) ? p.lines : [],
    }));

    return createEncryptedResponse({
      success: true,
      payments: paymentsList,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch payments' },
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user || !auth.isAdmin) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Administrator permission required.' },
        403
      );
    }

    const body = await parseEncryptedRequest<any>(request);
    const paymentsToUpsert = Array.isArray(body.payments)
      ? body.payments
      : body.payment
      ? [body.payment]
      : [];

    if (paymentsToUpsert.length === 0) {
      return createEncryptedResponse({ error: 'No payment data provided.' }, 400);
    }

    // Pre-fetch profiles to resolve non-UUID user_ids (e.g. email or employee_no)
    const { data: profiles } = await supabaseServer
      .from('profiles')
      .select('id, email, employee_no');

    const profileIdMap = new Map<string, string>();
    (profiles || []).forEach((p: any) => {
      if (p.id) profileIdMap.set(p.id.toLowerCase().trim(), p.id);
      if (p.email) profileIdMap.set(p.email.toLowerCase().trim(), p.id);
      if (p.employee_no) profileIdMap.set(p.employee_no.toLowerCase().trim(), p.id);
    });

    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const cleaned = paymentsToUpsert.map((p: any) => {
      const rawUserId = String(p.user_id || '').trim();
      const resolvedUserId = profileIdMap.get(rawUserId.toLowerCase()) || (isUuid(rawUserId) ? rawUserId : auth.user.id);

      return {
        id: p.id,
        pay_period_id: p.pay_period_id,
        user_id: resolvedUserId,
        month: p.month || null,
        total_hours: Number(p.total_hours) || 0,
        sessions_count: Number(p.sessions_count) || 0,
        gross_amount: Number(p.gross_amount) || 0,
        status: p.status || 'pending',
        method: p.method || null,
        reference_no: p.reference_no || null,
        paid_at: p.paid_at || null,
        status_reason: p.status_reason || null,
        generated_at: p.generated_at || new Date().toISOString(),
        updated_by_name: p.updated_by_name || `${auth.user.first_name || ''} ${auth.user.last_name || ''}`.trim() || 'Admin',
        lines: Array.isArray(p.lines) ? p.lines : [],
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabaseServer
      .from('payments')
      .upsert(cleaned)
      .select();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      payments: data || cleaned,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert payments' },
      500
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user || !auth.isAdmin) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Administrator permission required.' },
        403
      );
    }

    const body = await parseEncryptedRequest<any>(request);
    if (body.pay_period_id) {
      const { error } = await supabaseServer
        .from('payments')
        .delete()
        .eq('pay_period_id', body.pay_period_id);
      if (error) {
        return createEncryptedResponse({ error: error.message }, 400);
      }
      return createEncryptedResponse({ success: true, pay_period_id: body.pay_period_id });
    }

    if (body.id) {
      const { error } = await supabaseServer
        .from('payments')
        .delete()
        .eq('id', body.id);
      if (error) {
        return createEncryptedResponse({ error: error.message }, 400);
      }
      return createEncryptedResponse({ success: true, id: body.id });
    }

    return createEncryptedResponse({ error: 'ID or pay_period_id is required' }, 400);
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to delete payment' },
      500
    );
  }
}
