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
import { supabase } from '@/lib/data/supabase';

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
 * Implémentation STOCKAGE OBJET (Cloudflare R2) — Phase A.
 *
 * L'upload ne passe PAS le blob par notre serveur : on demande d'abord une URL
 * PRÉSIGNÉE à `POST /api/storage/sign-upload` (authentifiée par le cookie de
 * session, envoyé automatiquement en same-origin), puis on `PUT` les octets
 * DIRECTEMENT vers R2 avec cette URL. La suppression passe par
 * `POST /api/storage/delete` (le secret R2 est server-only). La lecture publique
 * se construit depuis `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` — c'est un domaine de
 * lecture PUBLIC (pas un secret), donc son exposition en `NEXT_PUBLIC_*` est sûre
 * et évite un aller-retour serveur pour construire l'URL d'une image.
 */
export class ObjectStoreProvider implements StorageProvider {
  readonly backend = 'object-store' as const;
  /** Base de lecture publique, sans slash final. Ex. `https://cdn.suimini.app`. */
  private publicBase: string;
  constructor(publicBase: string) {
    this.publicBase = publicBase.replace(/\/$/, '');
  }

  async upload(path: string, body: Blob, opts: StorageUploadOptions): Promise<{ error: string | null }> {
    try {
      const signRes = await fetch('/api/storage/sign-upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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

  async remove(path: string): Promise<void> {
    try {
      await fetch('/api/storage/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch { /* best-effort */ }
  }

  pathFromPublicUrl(url: string): string | null {
    if (!this.publicBase || !url.startsWith(this.publicBase + '/')) return null;
    const path = decodeURIComponent(url.slice(this.publicBase.length + 1).split('?')[0]);
    return path || null;
  }
}

/**
 * Frontière UNIQUE côté navigateur pour le stockage d'avatars.
 *
 * Aujourd'hui (défaut/rollback) : renvoie le passe-plat Supabase quand Supabase
 * est configuré, sinon `null` (l'appelant retombe sur le data-URL local — mode
 * invité/démo). Comportement EXACT d'avant l'extraction TANT QUE le flag n'est
 * pas posé.
 *
 * Flip Phase A : si `NEXT_PUBLIC_STORAGE_BACKEND === 'r2'` (flag CÔTÉ CLIENT,
 * build-time — pas un env serveur runtime comme `DB_BACKEND`, car l'upload part du
 * navigateur, cf. §4.3 du plan), on renvoie `ObjectStoreProvider`. Sinon on garde
 * `SupabaseStorageProvider` à l'identique → zéro changement tant que le user n'a
 * pas flippé le flag. Voir `docs/railway-auth-storage-migration.md` (Phase A).
 */
export function getStorageProvider(bucket = 'avatars'): StorageProvider | null {
  if (process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'r2') {
    const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;
    // Sans domaine public configuré, on ne peut pas construire d'URL de lecture →
    // repli sûr sur Supabase (jamais de crash / d'URL cassée).
    if (publicBase) return new ObjectStoreProvider(publicBase);
  }
  if (!supabase) return null;
  return new SupabaseStorageProvider(supabase, bucket);
}
