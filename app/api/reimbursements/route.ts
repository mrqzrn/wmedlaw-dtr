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
      .from('reimbursement_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!auth.isAdmin) {
      query = query.eq('user_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query reimbursement_requests:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, reimbursements: [] }, 400);
    }

    return createEncryptedResponse({
      success: true,
      reimbursements: data || [],
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch reimbursement requests' },
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
    const reimb = body.reimbursement || body;

    if (!reimb || !reimb.id || !reimb.user_id) {
      return createEncryptedResponse(
        { error: 'Valid reimbursement request with ID and user_id is required' },
        400
      );
    }

    const trimmedTitle = (reimb.title || '').trim();
    if (!trimmedTitle) {
      return createEncryptedResponse(
        { error: 'Reimbursement title or name is required.' },
        400
      );
    }

    const numAmount = Number(reimb.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return createEncryptedResponse(
        { error: 'Reimbursement amount must be a positive number greater than 0.' },
        400
      );
    }

    // Role-based protection: non-admins can only submit for their own user_id
    if (!auth.isAdmin && reimb.user_id !== auth.user.id) {
      return createEncryptedResponse(
        { error: 'Forbidden: You cannot file reimbursements for other users.' },
        403
      );
    }

    // Non-admins cannot self-approve or change approval status
    let effectiveStatus = reimb.status || 'pending';
    if (!auth.isAdmin && effectiveStatus !== 'pending') {
      effectiveStatus = 'pending';
    }

    const payload = {
      id: reimb.id,
      user_id: reimb.user_id,
      title: trimmedTitle,
      amount: Math.round(numAmount * 100) / 100,
      category: (reimb.category || 'General').trim(),
      expense_date: reimb.expense_date || new Date().toISOString().slice(0, 10),
      description: (reimb.description || '').trim(),
      receipt_url: reimb.receipt_url || null,
      status: effectiveStatus,
      pay_period_id: reimb.pay_period_id || null,
      reviewed_by_name: auth.isAdmin ? reimb.reviewed_by_name || null : null,
      review_note: auth.isAdmin ? reimb.review_note || null : null,
      reviewed_at: auth.isAdmin ? reimb.reviewed_at || null : null,
      payment_id: auth.isAdmin ? reimb.payment_id || null : null,
      payment_line_id: auth.isAdmin ? reimb.payment_line_id || null : null,
      created_at: reimb.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('reimbursement_requests')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      reimbursement: data || payload,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert reimbursement request' },
      500
    );
  }
}

export async function DELETE(request: Request) {
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
    const id = body.id;
    if (!id) {
      return createEncryptedResponse({ error: 'Reimbursement ID is required' }, 400);
    }

    // Check ownership if not admin
    if (!auth.isAdmin) {
      const { data: existing, error: findError } = await supabaseServer
        .from('reimbursement_requests')
        .select('user_id, status')
        .eq('id', id)
        .maybeSingle();

      if (findError || !existing) {
        return createEncryptedResponse({ error: 'Reimbursement request not found' }, 404);
      }

      if (existing.user_id !== auth.user.id) {
        return createEncryptedResponse({ error: 'Forbidden: You cannot delete this request' }, 403);
      }

      if (existing.status !== 'pending') {
        return createEncryptedResponse(
          { error: 'Cannot cancel an adjudicated reimbursement request' },
          400
        );
      }
    }

    const { error: delError } = await supabaseServer
      .from('reimbursement_requests')
      .delete()
      .eq('id', id);

    if (delError) {
      return createEncryptedResponse({ error: delError.message }, 400);
    }

    return createEncryptedResponse({ success: true, id });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to delete reimbursement request' },
      500
    );
  }
}
