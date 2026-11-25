import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabaseServer = createServerClient();
    const auth = await authenticateApiRequest(request, supabaseServer);
    if (auth.error || !auth.user || !auth.isAdmin) {
      return createEncryptedResponse(
        { error: 'Unauthorized: Administrator permission required.' },
        403
      );
    }

    const { data, error } = await supabaseServer
      .from('wage_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not query wage_history:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, wageHistory: [] }, 400);
    }

    return createEncryptedResponse({
      success: true,
      wageHistory: data || [],
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch wage history' },
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
    const item = body.wage || body;

    const payload = {
      id: item.id || `wage-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: item.user_id,
      hourly_rate: Number(item.hourly_rate) || 0,
      effective_from: item.effective_from || new Date().toISOString().split('T')[0],
      effective_to: item.effective_to || null,
      note: item.note || '',
      set_by_name: item.set_by_name || 'Administrator',
      created_at: item.created_at || new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('wage_history')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      wage: data || payload,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert wage history' },
      500
    );
  }
}
