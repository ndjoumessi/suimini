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

/**
 * Frontière UNIQUE côté mobile. Aujourd'hui : passe-plat Supabase quand configuré,
 * sinon `null` (mode démo → le caller garde l'uri locale). Comportement identique
 * à avant l'extraction. Demain : point d'insertion pour un backend objet-store.
 */
export function getStorageProvider(bucket = 'avatars'): StorageProvider | null {
  if (!supabase) return null;
  return new SupabaseStorageProvider(supabase, bucket);
}
