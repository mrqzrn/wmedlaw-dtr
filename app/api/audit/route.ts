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
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);

    if (!auth.isAdmin) {
      query = query.eq('actor_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query audit_logs:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, logs: [] }, 400);
    }

    return createEncryptedResponse({
      success: true,
      logs: data || [],
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch audit logs' },
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
    const log = body.log || body;

    const payload = {
      id: log.id || `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actor_id: log.actor_id || auth.user.id,
      actor_name: log.actor_name || `${auth.user.first_name || ''} ${auth.user.last_name || ''}`.trim() || 'User',
      actor_role: log.actor_role || (auth.isAdmin ? 'admin' : 'employee'),
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      details: log.details || '',
      before: log.before || null,
      after: log.after || null,
      is_system_scope: Boolean(log.is_system_scope),
      created_at: log.created_at || new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('audit_logs')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      log: data || payload,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to record audit log' },
      500
    );
  }
}
