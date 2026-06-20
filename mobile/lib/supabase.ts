/**
 * Supabase client for mobile. Mirrors the web app: when the env vars are absent
 * the client is `null` and the app falls back to the local demo tree.
 *
 * Session persistence uses MMKV when available (fast, synchronous), falling back
 * to in-memory storage on Expo Go — see lib/storage.ts.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createKVStorage } from './storage';

const storage = createKVStorage('suimini-auth');

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** `null` when Supabase isn't configured → the app runs in demo mode. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: mmkvStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
