import { createServerClient } from '@/lib/supabase/server';
import { createEncryptedResponse, parseEncryptedRequest, authenticateApiRequest } from '@/lib/crypto-server';
import { INITIAL_SETTINGS } from '@/lib/mock-data';

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
      .from('system_settings')
      .select('*')
      .eq('id', 'global_settings')
      .maybeSingle();

    if (error) {
      console.warn('Could not query system_settings:', error.message);
      return createEncryptedResponse({ success: false, error: error.message, settings: INITIAL_SETTINGS }, 400);
    }

    if (!data) {
      // Seed default settings into Supabase
      try {
        const payload = {
          id: 'global_settings',
          ...INITIAL_SETTINGS,
          updated_at: new Date().toISOString(),
        };
        await supabaseServer.from('system_settings').upsert(payload);
        return createEncryptedResponse({ success: true, settings: INITIAL_SETTINGS });
      } catch (e) {
        return createEncryptedResponse({ success: true, settings: INITIAL_SETTINGS });
      }
    }

    const formatted = {
      week_type: data.week_type || 'monday',
      pay_date_rule_semi_monthly: data.pay_date_rule_semi_monthly || '16th_and_1st',
      pay_date_rule_monthly: data.pay_date_rule_monthly || '1st',
      pay_date_rule_weekly: data.pay_date_rule_weekly || 'following_monday',
      weekend_pay_date_handling: data.weekend_pay_date_handling || 'previous_business_day',
      remarks_min_length: Number(data.remarks_min_length) || 10,
      retention_period_years: Number(data.retention_period_years) || 1,
      company_max_hours: data.company_max_hours || { day: 8.0, week: 40.0, month: 160.0 },
      timezone: data.timezone || 'Asia/Manila (UTC+8)',
      currency_symbol: data.currency_symbol || '₱',
    };

    return createEncryptedResponse({
      success: true,
      settings: formatted,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to fetch settings' },
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
    const s = body.settings || body;

    const payload = {
      id: 'global_settings',
      week_type: s.week_type || 'monday',
      pay_date_rule_semi_monthly: s.pay_date_rule_semi_monthly || '16th_and_1st',
      pay_date_rule_monthly: s.pay_date_rule_monthly || '1st',
      pay_date_rule_weekly: s.pay_date_rule_weekly || 'following_monday',
      weekend_pay_date_handling: s.weekend_pay_date_handling || 'previous_business_day',
      remarks_min_length: Number(s.remarks_min_length) || 10,
      retention_period_years: Number(s.retention_period_years) || 1,
      company_max_hours: s.company_max_hours || { day: 8.0, week: 40.0, month: 160.0 },
      timezone: s.timezone || 'Asia/Manila (UTC+8)',
      currency_symbol: s.currency_symbol || '₱',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseServer
      .from('system_settings')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      return createEncryptedResponse({ error: error.message }, 400);
    }

    return createEncryptedResponse({
      success: true,
      settings: data || payload,
    });
  } catch (err: any) {
    return createEncryptedResponse(
      { error: err?.message || 'Failed to update settings' },
      500
    );
  }
}
