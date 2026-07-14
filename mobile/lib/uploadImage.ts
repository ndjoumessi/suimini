/**
 * Avatar upload (mobile / Expo). Mirrors the web helper (`src/lib/uploadImage.ts`)
 * and its Supabase Storage contract EXACTLY so the same RLS policies apply:
 *
 *   bucket:  `avatars`
 *   path:    `${userId}/${safe(personId)}-${Date.now()}.webp`   ← userId FIRST
 *   options: { contentType: 'image/webp', upsert: true }
 *
 * The RLS policies on the `avatars` bucket key on the FIRST path segment being
 * the authenticated user's id — so we always use `user.id`, never a treeId.
 *
 * Flow: get user → (no user / demo → return {} so the caller keeps the local
 * uri) → compress (WebP ≤800px, `compressImageAsync`) → read the compressed
 * bytes to an ArrayBuffer (`fetch(uri).then(r => r.arrayBuffer())`, works for
 * local file:// uris in Expo — avoids an `expo-file-system` dependency) → upload
 * → getPublicUrl. Never throws: any failure comes back as `{ error }`.
 *
 * Byte sizes are derived from the ArrayBuffers we fetch anyway (compressed =
 * `afterBytes`; original re-fetched for `beforeBytes`), so the UI can surface a
 * "2,3 Mo → 187 Ko" line WITHOUT `expo-file-system`.
 */
import { supabase } from './supabase';
import { compressImageAsync } from './imageCompression';
import { getStorageProvider } from './storageProvider';

const AVATAR_BUCKET = 'avatars';

export interface MobileUploadResult {
  /** Public URL of the uploaded avatar. Absent in demo mode or on failure. */
  url?: string;
  /** Present when the upload failed (never thrown). */
  error?: string;
  /** Original size in bytes (0 when unknown). */
  beforeBytes?: number;
  /** Compressed size in bytes (0 when unknown). */
  afterBytes?: number;
}

/** Sanitize a person id for use in a storage object name. */
function safeId(personId: string): string {
  return (personId || 'new').replace(/[^a-zA-Z0-9_-]/g, '') || 'new';
}

/** Byte length of a local/remote uri via fetch (0 on failure). */
async function byteLength(uri: string): Promise<number> {
  try {
    const buf = await fetch(uri).then((r) => r.arrayBuffer());
    return buf.byteLength;
  } catch {
    return 0;
  }
}

/**
 * Upload a picked photo as the person's avatar. See module docstring.
 * @param localUri A local `file://` uri from expo-image-picker.
 * @param personId The person id (or 'new' for an unsaved person).
 */
export async function uploadAvatarMobile(
  localUri: string,
  personId: string,
): Promise<MobileUploadResult> {
  // No Supabase client configured → demo/offline; caller keeps the local uri.
  if (!supabase) return {};

  // Resolve the signed-in user. No user → demo mode: skip upload entirely.
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
  } catch {
    return {};
  }
  if (!userId) return {};

  // Compress to WebP ≤800px (never throws; returns the original uri on failure).
  const compressed = await compressImageAsync(localUri);

  // Read the compressed bytes for the upload (and as the "after" size).
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await fetch(compressed.uri).then((r) => r.arrayBuffer());
  } catch {
    return { error: 'read-failed' };
  }
  const afterBytes = arrayBuffer.byteLength;
  const beforeBytes =
    compressed.uri === localUri ? afterBytes : await byteLength(localUri);

  // Storage via the StorageProvider seam (behaviour-identical passthrough today;
  // future object-store backend slots in there — see storageProvider.ts). Auth
  // (getUser above) stays on Supabase: identity is out of scope for this seam.
  const storage = getStorageProvider(AVATAR_BUCKET);
  if (!storage) return {};
  try {
    const path = `${userId}/${safeId(personId)}-${Date.now()}.webp`;
    const { error } = await storage.upload(path, arrayBuffer, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600',
    });
    if (error) return { error, beforeBytes, afterBytes };

    const publicUrl = storage.getPublicUrl(path);
    if (!publicUrl) return { error: 'no-public-url', beforeBytes, afterBytes };
    return { url: publicUrl, beforeBytes, afterBytes };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'upload-failed';
    return { error: message, beforeBytes, afterBytes };
  }
}
