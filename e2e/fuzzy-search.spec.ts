/**
 * Tests unitaires de la recherche floue bamiléké/TEDA (aucun navigateur,
 * aucun réseau). Couvre :
 *   - normalizeBamilekeName (apostrophe, accents, « C » prothétique, vrais C)
 *   - expandSynonyms / canonicalize (SANA ↔ TSANA)
 *   - searchPersons (exact avant approché, synonymes, tolérance 1 faute, tri)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  normalizeBamilekeName,
  expandSynonyms,
  canonicalize,
  TEDA_SYNONYMS,
} from '../src/lib/bamilekeNames';
import { searchPersons } from '../src/lib/fuzzySearch';
import type { Person } from '../src/types';

// ---------- Fabrique de personnes minimale ----------

const person = (id: string, firstName: string, lastName = '', extra: Partial<Person> = {}): Person => ({
  id, firstName, lastName, gender: 'unknown', isAlive: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...extra,
} as Person);

// ---------- normalizeBamilekeName ----------

test('normalize : supprime les apostrophes (TEDA\'A → TEDAA)', () => {
  expect(normalizeBamilekeName("TEDA'A")).toBe('TEDAA');
  expect(normalizeBamilekeName('TEDA’A')).toBe('TEDAA'); // apostrophe typographique
});

test('normalize : retire les diacritiques (FOTIÉ → FOTIE)', () => {
  expect(normalizeBamilekeName('FOTIÉ')).toBe('FOTIE');
  expect(normalizeBamilekeName('fotié')).toBe('FOTIE'); // + majuscules
});

test('normalize : collapse le « C » prothétique (CFOTIE → FOTIE)', () => {
  expect(normalizeBamilekeName('CFOTIE')).toBe('FOTIE'); // C + F atypique
  expect(normalizeBamilekeName('CTSANA')).toBe('TSANA'); // C + T atypique
});

test('normalize : NE mutile PAS les vrais C', () => {
  expect(normalizeBamilekeName('CLAIRE')).toBe('CLAIRE');   // CL légitime
  expect(normalizeBamilekeName('CHRISTINE')).toBe('CHRISTINE'); // CH légitime
  expect(normalizeBamilekeName('CRISPIN')).toBe('CRISPIN'); // CR légitime
  expect(normalizeBamilekeName('CAMILLE')).toBe('CAMILLE'); // C + voyelle
  expect(normalizeBamilekeName('CHOTIE')).toBe('CHOTIE');   // CH gardé (→ FOTIE via synonyme)
});

test('normalize : compacte espaces et est idempotente', () => {
  expect(normalizeBamilekeName('  DJOUMESSI   Mathias ')).toBe('DJOUMESSI MATHIAS');
  const once = normalizeBamilekeName("CFOTIE'A");
  expect(normalizeBamilekeName(once)).toBe(once);
});

// ---------- canonicalize / expandSynonyms ----------

test('canonicalize : une variante remonte à sa canonique (SANA → TSANA)', () => {
  expect(canonicalize('SANA')).toBe('TSANA');
  expect(canonicalize('sana')).toBe('TSANA');
  expect(canonicalize('TSANA')).toBe('TSANA'); // canonique inchangée
  expect(canonicalize('CFOTIE')).toBe('FOTIE'); // variante + C prothétique
  expect(canonicalize("TEDA'A")).toBe('TEDA');
});

test('canonicalize : un nom inconnu renvoie sa simple normalisation', () => {
  expect(canonicalize('NGUEMO')).toBe('NGUEMO');
});

test('expandSynonyms : canonique + toutes les variantes normalisées', () => {
  const s = expandSynonyms('SANA');
  expect(s).toContain('TSANA'); // canonique
  expect(s).toContain('SANA');  // variante d'entrée
  expect(s).toContain('TSAN');  // autre variante
});

test('expandSynonyms : depuis la canonique renvoie aussi les variantes', () => {
  const s = expandSynonyms('FOTIE');
  expect(s).toContain('FOTIE');
  expect(s).toContain('CFOTIE');
  expect(s).toContain('CHOTIE');
});

test('TEDA_SYNONYMS : contient les familles attendues', () => {
  expect(Object.keys(TEDA_SYNONYMS)).toEqual(
    expect.arrayContaining(['FOTIE', 'DONGMO', 'TSANA', 'DJOUMESSI', 'TEKEUGUETSOP', 'TEDA']),
  );
});

// ---------- searchPersons ----------

const PEOPLE: Person[] = [
  person('p-tsana', 'TSANA', 'Sébastien'),     // NOM = firstName (convention TEDA)
  person('p-tsano', 'TSANO', 'Paul'),          // faute de frappe proche de TSANA
  person('p-fotie', 'FOTIE', 'Marie'),
  person('p-djoum', 'DJOUMESSI', 'Mathias'),
  person('p-far',   'ZUMKELLER', 'Anne'),      // sans rapport
];

test('searchPersons : exact/synonyme classé avant approché', () => {
  const res = searchPersons('TSANA', PEOPLE);
  expect(res.length).toBeGreaterThan(0);
  // Le TSANA exact arrive en tête, avant le TSANO approché.
  expect(res[0].person.id).toBe('p-tsana');
  expect(res[0].kind).toBe('exact');
  const tsano = res.find(r => r.person.id === 'p-tsano');
  expect(tsano?.kind).toBe('fuzzy');
  // L'index de l'exact précède celui de l'approché.
  expect(res.findIndex(r => r.person.id === 'p-tsana'))
    .toBeLessThan(res.findIndex(r => r.person.id === 'p-tsano'));
});

test('searchPersons : « SANA » retrouve une personne « TSANA » (synonyme)', () => {
  const res = searchPersons('SANA', PEOPLE);
  const hit = res.find(r => r.person.id === 'p-tsana');
  expect(hit).toBeTruthy();
});

test('searchPersons : « CFOTIE » retrouve « FOTIE » (C prothétique)', () => {
  const res = searchPersons('CFOTIE', PEOPLE);
  expect(res.find(r => r.person.id === 'p-fotie')).toBeTruthy();
});

test('searchPersons : tolère une faute de frappe unique (DJOUMSSI → DJOUMESSI)', () => {
  const res = searchPersons('DJOUMSSI', PEOPLE);
  expect(res.find(r => r.person.id === 'p-djoum')).toBeTruthy();
});

test('searchPersons : scores triés en ordre décroissant par type', () => {
  const res = searchPersons('TSANA', PEOPLE);
  // L'exact (score ~1) domine ; parmi les approchés, tri décroissant.
  const exact = res.filter(r => r.kind === 'exact');
  const fuzzy = res.filter(r => r.kind === 'fuzzy');
  for (let i = 1; i < exact.length; i++) expect(exact[i - 1].score).toBeGreaterThanOrEqual(exact[i].score);
  for (let i = 1; i < fuzzy.length; i++) expect(fuzzy[i - 1].score).toBeGreaterThanOrEqual(fuzzy[i].score);
  if (exact.length && fuzzy.length) expect(exact[0].score).toBeGreaterThanOrEqual(fuzzy[0].score);
});

test('searchPersons : requête vide → aucun résultat', () => {
  expect(searchPersons('   ', PEOPLE)).toEqual([]);
});

test('searchPersons : une personne sans rapport n’est pas retournée', () => {
  const res = searchPersons('TSANA', PEOPLE);
  expect(res.find(r => r.person.id === 'p-far')).toBeFalsy();
});
