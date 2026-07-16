/**
 * Client-side image compression (web).
 *
 * The single choke point for shrinking user-supplied photos before they hit
 * Supabase Storage (or a data URL fallback). Downscales to fit within
 * 800×800 (aspect preserved, never upscaled) and re-encodes as WebP q0.85.
 *
 * Design rules:
 *  - Never throws. On ANY failure (missing browser APIs, undecodable file,
 *    encode failure) it returns the original file with before == after.
 *  - Skips tiny files (< 200 KB) and images that are already WebP — the win
 *    would be marginal and re-encoding could even grow them.
 *
 * `shouldCompress` and `formatBytes` are pure and exported so they can be
 * unit-tested in node (canvas / createImageBitmap are browser-only).
 */

const MAX_DIM = 800;
const QUALITY = 0.85;
const MIN_BYTES = 200 * 1024; // below this, don't bother
const OUTPUT_TYPE = 'image/webp';

export interface CompressionResult {
  file: File;
  beforeBytes: number;
  afterBytes: number;
}

/** Pure decision helper (testable in node): compress only larger, non-webp images. */
export function shouldCompress({ size, type }: { size: number; type: string }): boolean {
  if (typeof size === 'number' && size < MIN_BYTES) return false;
  if (type === 'image/webp') return false;
  return true;
}

/** Human-readable byte size, e.g. 245760 → "240 Ko". Pure (testable in node). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const rounded = value >= 100 || i === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}

/** True when the browser APIs we rely on are present. */
function canUseCanvasPipeline(): boolean {
  return (
    typeof createImageBitmap === 'function' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function' &&
    typeof HTMLCanvasElement !== 'undefined'
  );
}

/**
 * Compress an image File. See module docstring for guarantees.
 * Returns the original untouched (before == after) whenever compression is
 * skipped or fails.
 */
export async function compressImage(file: File): Promise<CompressionResult> {
  const original: CompressionResult = { file, beforeBytes: file.size, afterBytes: file.size };

  try {
    if (!shouldCompress({ size: file.size, type: file.type })) return original;
    if (!file.type.startsWith('image/')) return original;
    if (!canUseCanvasPipeline()) return original;

    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return original;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, w, h);

      if (typeof canvas.toBlob !== 'function') return original;
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, OUTPUT_TYPE, QUALITY));
      if (!blob) return original;

      // If re-encoding produced something bigger (rare, e.g. already-optimized),
      // keep the original.
      if (blob.size >= file.size) return original;

      const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
      const compressed = new File([blob], `${base}.webp`, { type: OUTPUT_TYPE });
      return { file: compressed, beforeBytes: file.size, afterBytes: compressed.size };
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  } catch {
    return original;
  }
}
