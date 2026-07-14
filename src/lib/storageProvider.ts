/**
 * Frontière STOCKAGE OBJET (Phase 2 — migration Auth+Storage, ébauche additive).
 *
 * ⚠️ ÉCHAFAUDAGE / SEAM UNIQUEMENT — ZÉRO changement de comportement aujourd'hui.
 * Une seule implémentation existe et est active : `SupabaseStorageProvider`, un
 * passe-plat FIDÈLE des appels `supabase.storage.from('avatars').*` que faisait
 * déjà `uploadImage.ts`. Le but est de créer le MÊME point d'insertion que
 * `DataStore` (dataStore.ts) a créé pour les données : une interface + un
 * sélecteur, de sorte qu'une future implémentation objet-store (Cloudflare R2 /
 * MinIO / …) puisse se brancher EXACTEMENT comme `RailwayStore` l'a fait — sans
 * toucher les appelants.
 *
 * ⚠️ DIFFÉRENCE STRUCTURELLE avec la migration DONNÉES (à ne pas oublier) :
 * l'upload avatar part du NAVIGATEUR DIRECTEMENT vers Supabase Storage (il ne
 * passe PAS par `/api/data/*`). Un vrai backend alternatif (R2…) exigera donc
 * soit des URLs d'upload signées émises par une route serveur, soit un endpoint
 * d'upload dédié — décision à trancher dans le plan. Le flag de sélection ne peut
 * pas être un env serveur runtime lu par appel (comme `DB_BACKEND`) : le choix se
 * fait côté client. Voir `docs/railway-auth-storage-migration.md` (Phase A).
 *
 * TANT QUE la nouvelle implémentation n'existe pas, `getStorageProvider()` renvoie
 * TOUJOURS le passe-plat Supabase (ou `null` si Supabase n'est pas configuré →
 * l'appelant retombe sur le data-URL local, comme aujourd'hui).
 */
import { supabase } from './supabase';

export type StorageBackend = 'supabase' | 'object-store';

export interface StorageUploadOptions {
  contentType: string;
  upsert?: boolean;
  cacheControl?: string;
}

/**
 * Opérations de stockage objet, backend-agnostiques. Modelées EXACTEMENT sur ce
 * dont `uploadImage.ts` a besoin (upload / URL publique / suppression / extraction
 * du chemin depuis une URL publique) — rien de plus, pour que le passe-plat soit
 * byte-identique au code d'origine.
 */
export interface StorageProvider {
  readonly backend: StorageBackend;
  /** Upload un objet à `path` (relatif au bucket). `error` non-null = échec. */
  upload(path: string, body: Blob, opts: StorageUploadOptions): Promise<{ error: string | null }>;
  /** URL publique d'un objet (null si indisponible). */
  getPublicUrl(path: string): string | null;
  /** Suppression best-effort d'un objet (ne lève jamais). */
  remove(path: string): Promise<void>;
  /** Extrait le chemin d'objet depuis une URL publique de CE backend (null sinon). */
  pathFromPublicUrl(url: string): string | null;
}

/**
 * Passe-plat Supabase Storage. Réplique À L'IDENTIQUE les appels que faisait
 * `uploadImage.ts` (mêmes arguments d'upload, même dérivation de l'URL publique,
 * même parsing du marqueur `/object/public/<bucket>/`). AUCUNE nouvelle logique.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly backend = 'supabase' as const;
  constructor(private client: NonNullable<typeof supabase>, private bucket: string) {}

  async upload(path: string, body: Blob, opts: StorageUploadOptions): Promise<{ error: string | null }> {
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

  async remove(path: string): Promise<void> {
    try { await this.client.storage.from(this.bucket).remove([path]); } catch { /* best-effort */ }
  }

  pathFromPublicUrl(url: string): string | null {
    const marker = `/object/public/${this.bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
    return path || null;
  }
}

/**
 * Frontière UNIQUE côté navigateur pour le stockage d'avatars.
 *
 * Aujourd'hui : renvoie le passe-plat Supabase quand Supabase est configuré, sinon
 * `null` (l'appelant retombe sur le data-URL local — mode invité/démo). C'est le
 * comportement EXACT d'avant l'extraction.
 *
 * Demain : c'est ICI qu'une implémentation `ObjectStoreProvider` (R2/MinIO via URLs
 * signées) se branchera derrière un flag, exactement comme `getDataStore` choisit
 * `RailwayStore`. Rien n'est encore implémenté — voir
 * `docs/railway-auth-storage-migration.md` (Phase A — Storage).
 */
export function getStorageProvider(bucket = 'avatars'): StorageProvider | null {
  if (!supabase) return null;
  return new SupabaseStorageProvider(supabase, bucket);
}
