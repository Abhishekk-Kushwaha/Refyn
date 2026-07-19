import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

// Single Supabase client for the whole app. The anon/publishable key is safe
// to ship in the bundle — RLS is the security boundary, not this key.
// (The service_role key must NEVER appear in this codebase.)

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.'
      );
    }
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes the magic-link redirect automatically
      },
    });
  }
  return client;
};
