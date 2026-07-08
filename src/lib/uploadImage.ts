import { supabase } from './supabase';
import { compressImage } from './imageCompression';

export interface UploadResult {
  url: string;
  /** true when the image is stored inline (data URL) rather than in Supabase Storage */
  base64: boolean;
  warning?: string;
  /** Original file size in bytes, before client-side compression. */
  beforeBytes?: number;
  /** Compressed file size in bytes. Equals beforeBytes when nothing was compressed. */
  afterBytes?: number;
}

const AVATAR_BUCKET = 'avatars';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** File extension for a mime type (used for the storage object name). */
function extFor(type: string): string {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  return 'jpg';
}

/**
 * Upload an avatar image. Strategy:
 *  1. Compress client-side (shared `compressImage` choke point → WebP, ≤800px).
 *  2. If Supabase + a signed-in user → upload to the `avatars` bucket at
 *     `{userId}/{personId}-{ts}.{ext}` and return the public URL.
 *  3. Otherwise (demo/guest, or upload failure) → return a compressed data URL.
 *
 * The returned `beforeBytes`/`afterBytes` report the compression outcome so the
 * UI can surface "compressed X → Y". They are equal when compression was
 * skipped (tiny/webp/undecodable). Callers that ignore them keep working.
 */
export async function uploadAvatar(file: File, personId: string): Promise<UploadResult> {
  const { file: blob, beforeBytes, afterBytes } = await compressImage(file);
  const contentType = blob.type || 'image/jpeg';

  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const safeId = (personId || 'new').replace(/[^a-zA-Z0-9_-]/g, '');
        const path = `${user.id}/${safeId}-${Date.now()}.${extFor(contentType)}`;
        const { error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, blob, { upsert: true, contentType, cacheControl: '3600' });
        if (!error) {
          const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
          if (data?.publicUrl) return { url: data.publicUrl, base64: false, beforeBytes, afterBytes };
        }
        // error (e.g. bucket missing / policy) → fall through to base64
      }
    } catch {
      /* fall through to base64 */
    }
  }

  const dataUrl = await blobToDataUrl(blob);
  const approxKB = Math.round((dataUrl.length * 3) / 4 / 1024);
  return {
    url: dataUrl,
    base64: true,
    warning: `Image compressée (~${approxKB} Ko, stockée localement)`,
    beforeBytes,
    afterBytes,
  };
}

/**
 * Best-effort removal of a previously-uploaded avatar from Supabase Storage.
 * No-op for base64/data URLs (demo/guest) or non-storage URLs. Never throws —
 * the UI removal (dropping the URL from the person record) is what matters; the
 * storage object is cleaned up opportunistically when a real session exists.
 */
export async function deleteAvatarByUrl(url: string): Promise<void> {
  if (!supabase || !url || url.startsWith('data:')) return;
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  if (!path) return;
  try { await supabase.storage.from(AVATAR_BUCKET).remove([path]); } catch { /* best-effort */ }
}
