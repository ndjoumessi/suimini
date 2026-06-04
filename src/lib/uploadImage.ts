import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  /** true when the image is stored inline (data URL) rather than in Supabase Storage */
  base64: boolean;
  warning?: string;
}

const AVATAR_BUCKET = 'avatars';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Downscale to maxDim and re-encode as JPEG to keep avatars small (~tens of KB). */
async function compress(file: File, maxDim = 512, quality = 0.82): Promise<Blob> {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objUrl);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
    return blob ?? file;
  } catch {
    return file; // non-decodable (e.g. SVG) → keep original
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/**
 * Upload an avatar image. Strategy:
 *  1. Compress client-side.
 *  2. If Supabase + a signed-in user → upload to the `avatars` bucket at
 *     `{userId}/{personId}-{ts}.jpg` and return the public URL.
 *  3. Otherwise (demo/guest, or upload failure) → return a compressed data URL.
 */
export async function uploadAvatar(file: File, personId: string): Promise<UploadResult> {
  const blob = await compress(file);

  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const safeId = (personId || 'new').replace(/[^a-zA-Z0-9_-]/g, '');
        const path = `${user.id}/${safeId}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
        if (!error) {
          const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
          if (data?.publicUrl) return { url: data.publicUrl, base64: false };
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
  };
}
