/**
 * Tests unitaires du bascule d'aperçu clair/sombre de PrintModal (aucun
 * navigateur, aucun localStorage — helpers PURS). L'aperçu à l'écran change ;
 * la sortie imprimée (window.open/print) reste inchangée.
 */
import { test, expect } from '@playwright/test';
import { nextPreviewMode, previewClass, type PreviewMode } from '../src/components/PrintModal';

test('nextPreviewMode flips dark → light and back', () => {
  expect(nextPreviewMode('dark')).toBe('light');
  expect(nextPreviewMode('light')).toBe('dark');
});

test('nextPreviewMode is an involution (round-trips)', () => {
  const modes: PreviewMode[] = ['dark', 'light'];
  for (const m of modes) {
    expect(nextPreviewMode(nextPreviewMode(m))).toBe(m);
  }
});

test('previewClass maps each mode to its well class', () => {
  expect(previewClass('light')).toBe('print-preview-light');
  expect(previewClass('dark')).toBe('print-preview-dark');
});

test('previewClass returns a distinct class per mode', () => {
  expect(previewClass('light')).not.toBe(previewClass('dark'));
});
