import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { INITIAL_PAY_PERIODS } from '@/lib/mock-data';

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

    const { data, error } = await supabaseServer
      .from('pay_periods')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.warn('Could not query pay_periods:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, payPeriods: [] }, 400);
    }

    // Auto-seed initial periods in Supabase if the table is currently empty
    if (!data || data.length === 0) {
      try {
        const { data: seeded, error: seedErr } = await supabaseServer
          .from('pay_periods')
          .upsert(INITIAL_PAY_PERIODS)
          .select();
        if (!seedErr && seeded) {
          return createEncryptedResponse({ success: true, payPeriods: seeded });
        }
      } catch (err) {
        console.warn('Error auto-seeding pay_periods:', err);
      }
    }

    return createEncryptedResponse({
      success: true,
      payPeriods: data || [],
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch pay periods' },
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
    const periodsToUpsert = Array.isArray(body.payPeriods)
      ? body.payPeriods
      : body.payPeriod
      ? [body.payPeriod]
      : [];

    if (periodsToUpsert.length === 0) {
      return createEncryptedResponse({ error: 'No pay period data provided.' }, 400);
    }

    const cleaned = periodsToUpsert.map((p: any) => ({
      id: p.id,
      frequency: p.frequency || 'monthly',
      start_date: p.start_date,
      end_date: p.end_date,
      pay_date: p.pay_date,
      status: p.status || 'open',
      week_type: p.week_type || null,
      closed_by_name: p.closed_by_name || null,
      locked_by_name: p.locked_by_name || null,
      purged_at: p.purged_at || null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabaseServer
      .from('pay_periods')
      .upsert(cleaned)
      .select();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      payPeriods: data || cleaned,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to upsert pay periods' },
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
    const id = body.id;
    if (!id) {
      return createEncryptedResponse({ error: 'Period ID required for deletion.' }, 400);
    }

    const { error } = await supabaseServer.from('pay_periods').delete().eq('id', id);
    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({ success: true, id });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to delete pay period' },
      500
    );
  }
}
