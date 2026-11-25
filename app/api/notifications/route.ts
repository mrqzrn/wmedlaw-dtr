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
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (auth.isAdmin) {
      query = query.or(`recipient_role.eq.admin,recipient_id.eq.${auth.user.id}`);
    } else {
      query = query.eq('recipient_id', auth.user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Could not query notifications:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, notifications: [] }, 400);
    }

    return createEncryptedResponse({
      success: true,
      notifications: data || [],
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch notifications' },
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
    const item = body.notification || body;

    const payload = {
      id: item.id || `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      recipient_role: item.recipient_role || 'admin',
      recipient_id: item.recipient_id || null,
      type: item.type || 'general',
      title: item.title || 'Notification',
      message: item.message || '',
      user_id: item.user_id || auth.user.id,
      month: item.month || null,
      link_tab: item.link_tab || null,
      is_read: Boolean(item.is_read),
      created_at: item.created_at || new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('notifications')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      notification: data || payload,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert notification' },
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
    if (body.id) {
      await supabaseServer.from('notifications').delete().eq('id', body.id);
      return createEncryptedResponse({ success: true, id: body.id });
    }

    if (body.clearAll) {
      if (auth.isAdmin) {
        await supabaseServer.from('notifications').delete().or(`recipient_role.eq.admin,recipient_id.eq.${auth.user.id}`);
      } else {
        await supabaseServer.from('notifications').delete().eq('recipient_id', auth.user.id);
      }
      return createEncryptedResponse({ success: true, cleared: true });
    }

    return createEncryptedResponse({ error: 'id or clearAll required' }, 400);
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to delete notification' },
      500
    );
  }
}
