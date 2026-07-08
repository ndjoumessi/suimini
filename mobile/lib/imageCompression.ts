/**
 * Client-side image compression (mobile / Expo).
 *
 * Shrinks a picked photo before it is uploaded to Supabase Storage. Resizes to
 * a max width of 800px (aspect preserved by ImageManipulator; height omitted so
 * it is derived) and re-encodes as WebP q0.85.
 *
 * Guarantees:
 *  - Never throws. On any failure returns the original uri with before == after.
 *  - Byte sizes: `expo-file-system` is NOT installed in this project, so we
 *    cannot stat the file sizes. `beforeBytes`/`afterBytes` therefore come back
 *    as 0 ("unknown"). The resize/re-encode still happens. If `expo-file-system`
 *    is later added, wire `statSizeAsync` (see note below) to populate them.
 *
 * Mirrors the web helper (`src/lib/imageCompression.ts`) intentionally — the two
 * projects are separate (see CLAUDE.md "Web ≠ mobile"), keep them in phase.
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_WIDTH = 800;
const QUALITY = 0.85;

export interface CompressionResult {
  uri: string;
  beforeBytes: number;
  afterBytes: number;
}

/**
 * Byte size of a local file uri. `expo-file-system` is not a dependency here, so
 * this returns 0 ("unknown"). To enable real sizing, install `expo-file-system`
 * and replace the body with:
 *   const FS = await import('expo-file-system');
 *   const info = await FS.getInfoAsync(uri);
 *   return typeof info?.size === 'number' ? info.size : 0;
 */
async function statSizeAsync(_uri: string): Promise<number> {
  return 0;
}

/** True when the uri already points at a webp (skip re-encoding). */
function isWebp(uri: string): boolean {
  return /\.webp($|\?)/i.test(uri);
}

/**
 * Compress an image referenced by a local uri. See module docstring.
 * Returns the original uri (before == after) whenever compression is skipped or
 * fails.
 */
export async function compressImageAsync(uri: string): Promise<CompressionResult> {
  const beforeBytes = await statSizeAsync(uri);

  try {
    if (isWebp(uri)) return { uri, beforeBytes, afterBytes: beforeBytes };

    const result = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_WIDTH } }],
      { compress: QUALITY, format: SaveFormat.WEBP },
    );
    if (!result?.uri) return { uri, beforeBytes, afterBytes: beforeBytes };

    const afterBytes = await statSizeAsync(result.uri);
    return { uri: result.uri, beforeBytes, afterBytes };
  } catch {
    return { uri, beforeBytes, afterBytes: beforeBytes };
  }
}
