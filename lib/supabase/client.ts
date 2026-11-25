import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://lnihrsvxodrrxcuxeenz.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_b3xJrdMeFJet3lH25Ql-IA_mx-gP5aa';

let browserClient: SupabaseClient | null = null;

/**
 * Returns a singleton instance of the Supabase browser client.
 */
export function getSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

export const supabase = getSupabaseClient();
