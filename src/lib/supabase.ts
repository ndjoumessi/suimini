import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both Supabase env vars are present — otherwise Suimini runs localStorage-only. */
export const isSupabaseConfigured = !!(url && anonKey);

/**
 * Shared Supabase browser client (cookie-based, PKCE flow → works with the
 * server-side /auth/callback route). `null` when Supabase isn't configured,
 * so the app stays 100% functional offline. Always guard with `if (supabase)`.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(url as string, anonKey as string)
  : null;
