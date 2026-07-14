/**
 * Frontière STOCKAGE OBJET côté mobile (Phase 2 — migration Auth+Storage, ébauche).
 *
 * ⚠️ ÉCHAFAUDAGE / SEAM UNIQUEMENT — ZÉRO changement de comportement. Miroir EXACT
 * du seam web (`src/lib/storageProvider.ts`) : une interface + un sélecteur, avec
 * une seule implémentation active, `SupabaseStorageProvider`, passe-plat fidèle des
 * appels `supabase.storage.from('avatars').*` que faisait déjà `uploadImage.ts`.
 *
 * Le corps d'upload est un `ArrayBuffer` (le flux mobile lit les octets compressés
 * via `fetch(uri).arrayBuffer()`), au lieu d'un `Blob` côté web — seule différence.
 *
 * Rien de nouveau n'est implémenté. Une future implémentation objet-store (R2/MinIO
 * via URLs signées) se branchera dans `getStorageProvider()` derrière un flag, comme
 * `RailwayStore` pour les données. Voir `docs/railway-auth-storage-migration.md`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type StorageBackend = 'supabase' | 'object-store';

export interface StorageUploadOptions {
  contentType: string;
  upsert?: boolean;
  cacheControl?: string;
}

export interface StorageProvider {
  readonly backend: StorageBackend;
  upload(path: string, body: ArrayBuffer, opts: StorageUploadOptions): Promise<{ error: string | null }>;
  getPublicUrl(path: string): string | null;
}

/** Passe-plat Supabase Storage (aucune nouvelle logique — miroir de l'appel d'origine). */
export class SupabaseStorageProvider implements StorageProvider {
  readonly backend = 'supabase' as const;
  constructor(private client: SupabaseClient, private bucket: string) {}

  async upload(path: string, body: ArrayBuffer, opts: StorageUploadOptions): Promise<{ error: string | null }> {
    const { error } = await this.client.storage.from(this.bucket).upload(path, body, {
      contentType: opts.contentType,
      upsert: opts.upsert,
      cacheControl: opts.cacheControl,
    });
    return { error: error ? error.message : null };
  }

  getPublicUrl(path: string): string | null {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  }
}

// Base API (même défaut que supabaseSync.ts) et domaine de lecture publique R2.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://suimini.vercel.app';

/**
 * Implémentation STOCKAGE OBJET (Cloudflare R2) — Phase A, miroir mobile du web.
 *
 * Le mobile n'a pas de cookie de session → on authentifie l'appel de signature
 * avec un `Authorization: Bearer <access_token>` (même patron que supabaseSync.ts /
 * notifications.ts). On demande une URL présignée à `POST /api/storage/sign-upload`,
 * puis on `PUT` l'`ArrayBuffer` DIRECTEMENT vers R2. La lecture publique se
 * construit depuis `EXPO_PUBLIC_R2_PUBLIC_BASE_URL` (domaine public, pas un secret).
 */
export class ObjectStoreProvider implements StorageProvider {
  readonly backend = 'object-store' as const;
  private publicBase: string;
  constructor(private client: SupabaseClient, publicBase: string) {
    this.publicBase = publicBase.replace(/\/$/, '');
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await this.client.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async upload(path: string, body: ArrayBuffer, opts: StorageUploadOptions): Promise<{ error: string | null }> {
    try {
      const signRes = await fetch(`${API_BASE_URL}/api/storage/sign-upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await this.authHeaders()) },
        body: JSON.stringify({ path, contentType: opts.contentType }),
      });
      if (!signRes.ok) {
        const data = await signRes.json().catch(() => null);
        return { error: (data as { error?: string } | null)?.error ?? `sign-upload ${signRes.status}` };
      }
      const { uploadUrl } = (await signRes.json()) as { uploadUrl?: string };
      if (!uploadUrl) return { error: 'URL de signature absente.' };

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': opts.contentType },
      });
      if (!putRes.ok) return { error: `PUT R2 ${putRes.status}` };
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'upload-failed' };
    }
  }

  getPublicUrl(path: string): string | null {
    if (!this.publicBase) return null;
    return `${this.publicBase}/${path}`;
  }
}

/**
 * Frontière UNIQUE côté mobile. Aujourd'hui (défaut/rollback) : passe-plat Supabase
 * quand configuré, sinon `null` (mode démo → le caller garde l'uri locale) —
 * comportement identique à avant l'extraction TANT QUE le flag n'est pas posé.
 *
 * Flip Phase A : si `EXPO_PUBLIC_STORAGE_BACKEND === 'r2'` (flag client, build-time)
 * ET un domaine public R2 est configuré, on renvoie `ObjectStoreProvider`. Sinon on
 * garde le passe-plat Supabase. Voir `docs/railway-auth-storage-migration.md`.
 */
export function getStorageProvider(bucket = 'avatars'): StorageProvider | null {
  if (!supabase) return null;
  if (process.env.EXPO_PUBLIC_STORAGE_BACKEND === 'r2') {
    const publicBase = process.env.EXPO_PUBLIC_R2_PUBLIC_BASE_URL;
    if (publicBase) return new ObjectStoreProvider(supabase, publicBase);
  }
  return new SupabaseStorageProvider(supabase, bucket);
}
