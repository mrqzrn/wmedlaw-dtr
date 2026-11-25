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
      .from('correction_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!auth.isAdmin) {
      query = query.eq('user_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query correction_requests:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, corrections: [] }, 400);
    }

    return createEncryptedResponse({
      success: true,
      corrections: data || [],
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch correction requests' },
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
    const corr = body.correction || body;

    if (!corr || !corr.id || !corr.user_id) {
      return createEncryptedResponse({ error: 'Valid correction request with ID and user_id is required' }, 400);
    }

    // Role-based protection: non-admins can only submit for their own user_id
    if (!auth.isAdmin && corr.user_id !== auth.user.id) {
      return createEncryptedResponse(
        { error: 'Forbidden: You cannot file corrections for other users.' },
        403
      );
    }

    // Finalization check: non-admins cannot file corrections for finalized months
    if (!auth.isAdmin && corr.work_date && corr.status === 'pending') {
      const monthPrefix = corr.work_date.slice(0, 7);
      const { data: approval } = await supabaseServer
        .from('monthly_self_approvals')
        .select('id')
        .eq('user_id', corr.user_id)
        .eq('month', monthPrefix)
        .maybeSingle();

      if (approval) {
        return createEncryptedResponse(
          { error: `Cannot submit correction: DTR records for ${monthPrefix} have already been finalized and certified.` },
          403
        );
      }
    }

    const payload = {
      id: corr.id,
      user_id: corr.user_id,
      dtr_entry_id: corr.dtr_entry_id || null,
      work_date: corr.work_date,
      requested_time_in: corr.requested_time_in,
      requested_time_out: corr.requested_time_out,
      reason: corr.reason,
      status: corr.status || 'pending',
      reviewed_by_name: corr.reviewed_by_name || null,
      review_note: corr.review_note || null,
      reviewed_at: corr.reviewed_at || null,
      created_at: corr.created_at || new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('correction_requests')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      correction: data || payload,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert correction request' },
      500
    );
  }
}
