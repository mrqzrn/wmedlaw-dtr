import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://lnihrsvxodrrxcuxeenz.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_b3xJrdMeFJet3lH25Ql-IA_mx-gP5aa';

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!supabaseSecretKey) {
  console.warn(
    '[supabase] SUPABASE_SECRET_KEY is not set; server client is falling back to the publishable key (RLS applies).'
  );
}

/**
 * Creates a server-side Supabase client.
 * Uses service role / secret key if provided, else anon key.
 */
export function createServerClient() {
  const key = supabaseSecretKey || supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
