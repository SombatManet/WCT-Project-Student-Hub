import { createClient } from '@supabase/supabase-js';

// These must match your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

/**
 * Throws a helpful error if Supabase isn't configured.
 * Use this to provide an actionable message in the frontend.
 */
export function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase environment variables are missing. Create a .env file at the project root (student-hub/.env) with:\n' +
      'VITE_SUPABASE_URL=https://<your-project>.supabase.co\n' +
      'VITE_SUPABASE_ANON_KEY=eyJ... (your anon public key)\n' +
      'Then restart the dev server.'
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey);