import type { PixelCrop } from 'react-image-crop';

/**
 * Shared `react-image-crop` canvas helpers — used by both GalleryView (fixed
 * 1:1 avatar crop) and PhotoAnalyzer (free-form pre-analysis crop, no forced
 * aspect ratio, since a family photo can have any composition/number of faces).
 * Extracted so the crop→canvas pixel math (natural-vs-rendered scale factors)
 * lives in one place instead of being duplicated per view.
 */

/** Renders the pixel-crop region of `image` (read at its NATURAL resolution,
 *  not the possibly-downscaled rendered size) onto `canvas`. `outSize`, when
 *  given, forces a square canvas (GalleryView's 120×120 live thumbnail);
 *  omitted, the canvas is sized to the crop's own (scaled) dimensions. */
export function cropToCanvas(canvas: HTMLCanvasElement, image: HTMLImageElement, c: PixelCrop, outSize?: number): boolean {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const srcW = c.width * scaleX;
  const srcH = c.height * scaleY;
  canvas.width = outSize ?? Math.max(1, Math.round(srcW));
  canvas.height = outSize ?? Math.max(1, Math.round(srcH));
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, c.x * scaleX, c.y * scaleY, srcW, srcH, 0, 0, canvas.width, canvas.height);
  return true;
}

/** Crops `image` to `c` via an offscreen canvas and returns a JPEG `File`
 *  (named after `filename`, extension swapped to `.jpg`). `null` on any
 *  canvas failure — callers should fall back to the original file. */
export async function cropToFile(image: HTMLImageElement, c: PixelCrop, filename: string, quality = 0.85): Promise<File | null> {
  const canvas = document.createElement('canvas');
  if (!cropToCanvas(canvas, image, c)) return null;
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) return null;
  const base = filename.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

/** True when `c` (in the image's RENDERED pixel units, e.g. a `PixelCrop`)
 *  covers essentially the whole rendered image — i.e. the user hasn't
 *  actually narrowed the selection, so callers can skip the crop→re-encode
 *  round trip entirely and keep the original file byte-for-byte. */
export function isFullFrameCrop(c: PixelCrop, renderedWidth: number, renderedHeight: number): boolean {
  return c.x <= 0.5 && c.y <= 0.5 && c.width >= renderedWidth - 1 && c.height >= renderedHeight - 1;
}
