/**
 * Tests unitaires des helpers PURS de compression d'image
 * (src/lib/imageCompression.ts) : aucun navigateur, aucune API canvas.
 *
 * `compressImage` s'appuie sur `createImageBitmap`/`canvas` (browser-only), donc
 * on ne teste ici que la logique décidable en node :
 *  - `shouldCompress(...)` : on saute les fichiers < 200 Ko et les WebP.
 *  - `formatBytes(...)`    : formatage lisible des octets.
 */
import { test, expect } from '@playwright/test';
import { shouldCompress, formatBytes } from '../src/lib/imageCompression';

const KB = 1024;
const MB = 1024 * 1024;

test.describe('shouldCompress', () => {
  test('skips files under 200 KB', () => {
    expect(shouldCompress({ size: 0, type: 'image/jpeg' })).toBe(false);
    expect(shouldCompress({ size: 50 * KB, type: 'image/png' })).toBe(false);
    expect(shouldCompress({ size: 199 * KB, type: 'image/jpeg' })).toBe(false);
  });

  test('compresses files at or above 200 KB', () => {
    expect(shouldCompress({ size: 200 * KB, type: 'image/jpeg' })).toBe(true);
    expect(shouldCompress({ size: 2 * MB, type: 'image/png' })).toBe(true);
  });

  test('never compresses webp (even large ones)', () => {
    expect(shouldCompress({ size: 5 * MB, type: 'image/webp' })).toBe(false);
    expect(shouldCompress({ size: 200 * KB, type: 'image/webp' })).toBe(false);
  });

  test('the 200 KB threshold wins over type for webp (both reasons skip)', () => {
    expect(shouldCompress({ size: 10 * KB, type: 'image/webp' })).toBe(false);
  });
});

test.describe('formatBytes', () => {
  test('handles zero / invalid input', () => {
    expect(formatBytes(0)).toBe('0 o');
    expect(formatBytes(-5)).toBe('0 o');
    expect(formatBytes(Number.NaN)).toBe('0 o');
  });

  test('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 o');
  });

  test('formats kilobytes with a decimal when small', () => {
    expect(formatBytes(200 * KB)).toBe('200 Ko');
    expect(formatBytes(1.5 * KB)).toBe('1.5 Ko');
  });

  test('formats megabytes', () => {
    expect(formatBytes(2 * MB)).toBe('2 Mo');
    expect(formatBytes(1.5 * MB)).toBe('1.5 Mo');
  });

  test('a compression outcome reads sensibly (2 Mo → 240 Ko)', () => {
    expect(formatBytes(2 * MB)).toBe('2 Mo');
    expect(formatBytes(240 * KB)).toBe('240 Ko');
  });
});
