/**
 * Tests unitaires PURS (aucun navigateur, aucun réseau) du post-traitement OCR
 * des actes d'état civil bamiléké : `src/lib/ocrNormalization.ts`. On vérifie
 * que la détection de variantes réutilise correctement `bamilekeNames`
 * (CFOTIE→FOTIE, DONMO→DONGMO, TEDA'A→TEDA, SANA→TSANA) et laisse les noms
 * canoniques intacts (DJOUMESSI), tout en restant sûr sur les entrées vides.
 */
import { test, expect } from '@playwright/test';
import {
  detectVariants, normalizeOcrPerson, normalizeOcrResult,
} from '../src/lib/search/ocrNormalization';

// ---------- detectVariants ----------

test('detectVariants : CFOTIE est une variante de FOTIE (C prothétique)', () => {
  const v = detectVariants('CFOTIE');
  expect(v.canonical).toBe('FOTIE');
  expect(v.original).toBe('CFOTIE');
  expect(v.isVariant).toBe(true);
});

test('detectVariants : DONMO → DONGMO', () => {
  const v = detectVariants('DONMO');
  expect(v.canonical).toBe('DONGMO');
  expect(v.isVariant).toBe(true);
});

test("detectVariants : TEDA'A → TEDA (apostrophe glottale)", () => {
  const v = detectVariants("TEDA'A");
  expect(v.canonical).toBe('TEDA');
  expect(v.isVariant).toBe(true);
});

test('detectVariants : SANA → TSANA', () => {
  const v = detectVariants('SANA');
  expect(v.canonical).toBe('TSANA');
  expect(v.isVariant).toBe(true);
});

test('detectVariants : un nom canonique (DJOUMESSI) n’est PAS une variante', () => {
  const v = detectVariants('DJOUMESSI');
  expect(v.canonical).toBe('DJOUMESSI');
  expect(v.isVariant).toBe(false);
});

test('detectVariants : un changement de casse seul n’est pas une variante', () => {
  const v = detectVariants('Djoumessi');
  expect(v.canonical).toBe('DJOUMESSI');
  expect(v.isVariant).toBe(false);
});

test('detectVariants : entrées vides / null / undefined sont sûres', () => {
  for (const input of ['', '   ', null, undefined]) {
    const v = detectVariants(input);
    expect(v).toEqual({ canonical: '', original: '', isVariant: false });
  }
});

// ---------- normalizeOcrPerson ----------

test('normalizeOcrPerson : CFOTIE → lastName canonique FOTIE + trace de variante', () => {
  const p = normalizeOcrPerson({ firstName: 'Jean', lastName: 'CFOTIE', role: 'sujet' });
  expect(p.lastName).toBe('FOTIE');
  expect(p.lastNameCanonical).toBe('FOTIE');
  expect(p.lastNameOriginal).toBe('CFOTIE');
  expect(p.lastNameIsVariant).toBe(true);
  // Les autres champs sont préservés intacts.
  expect(p.firstName).toBe('Jean');
  expect(p.role).toBe('sujet');
});

test('normalizeOcrPerson : un nom canonique reste inchangé', () => {
  const p = normalizeOcrPerson({ lastName: 'DJOUMESSI' });
  expect(p.lastName).toBe('DJOUMESSI');
  expect(p.lastNameIsVariant).toBe(false);
});

test('normalizeOcrPerson : lastName vide / absent est sûr', () => {
  const empty = normalizeOcrPerson({ lastName: '' });
  expect(empty.lastName).toBe('');
  expect(empty.lastNameIsVariant).toBe(false);

  const missing = normalizeOcrPerson({ firstName: 'Marie' } as { firstName: string; lastName?: string | null });
  expect(missing.lastName).toBeNull();
  expect(missing.lastNameIsVariant).toBe(false);
});

// ---------- normalizeOcrResult ----------

test('normalizeOcrResult : normalise chaque personne, préserve le reste du résultat', () => {
  const result = {
    type: 'acte_naissance',
    confidence: 0.9,
    persons: [
      { role: 'sujet', lastName: 'CFOTIE', firstName: 'Paul' },
      { role: 'pere', lastName: 'DONMO', firstName: 'Pierre' },
      { role: 'mere', lastName: 'DJOUMESSI', firstName: 'Marie' },
    ],
  };
  const out = normalizeOcrResult(result);
  expect(out.type).toBe('acte_naissance');
  expect(out.confidence).toBe(0.9);
  expect(out.persons.map(p => p.lastName)).toEqual(['FOTIE', 'DONGMO', 'DJOUMESSI']);
  expect(out.persons.map(p => p.lastNameIsVariant)).toEqual([true, true, false]);
  // Pur : l'entrée n'est pas mutée.
  expect(result.persons[0].lastName).toBe('CFOTIE');
});

test('normalizeOcrResult : persons absent → tableau vide, pas de crash', () => {
  const out = normalizeOcrResult({ type: 'autre' } as { type: string; persons: { lastName?: string | null }[] });
  expect(out.persons).toEqual([]);
});
