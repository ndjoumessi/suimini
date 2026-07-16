/**
 * Supabase client for mobile. Mirrors the web app: when the env vars are absent
 * the client is `null` and the app falls back to the local demo tree.
 *
 * Session persistence uses MMKV when available (fast, synchronous), falling back
 * to in-memory storage on Expo Go — see lib/storage.ts.
 *
 * Sécu F3 : cette instance MMKV (access + refresh token Supabase) est chiffrée
 * au repos via une clé Keychain/Keystore (expo-secure-store) — voir
 * `createKVStorage`/`getOrCreateEncryptionKey` dans lib/storage.ts pour le détail
 * (migration transparente d'une session déjà écrite en clair par une version
 * antérieure, repli gracieux sans chiffrement si SecureStore est indisponible).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createKVStorage } from './storage';

const storage = createKVStorage('suimini-auth', 'suimini_mmkv_auth_key');

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
