/**
 * Tests unitaires de la détection de doublons (aucun navigateur, aucun réseau).
 * Vérifient le barème par CHAMP de src/lib/duplicateDetection.ts :
 *   prénom +40, nom +30, année de naissance ±2 +20, même genre connu +10 ;
 *   seuil de conservation >= 60, tri décroissant, isBlocking >= 90.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  findPotentialDuplicates,
  isBlocking,
  birthYear,
  normalizeName,
} from '../src/lib/search/duplicateDetection';
import type { Person } from '../src/types';

// Fabrique de personne minimale : seuls les champs pertinents sont surchargés.
const P = (over: Partial<Person>): Person => ({
  id: 'x', firstName: '', lastName: '', gender: 'unknown', isAlive: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...over,
} as Person);

// ---------- Cas nominal : doublon quasi-certain (100 → bloquant) ----------

test('prénom + nom + même année + même genre → score 100 (bloquant)', () => {
  const res = findPotentialDuplicates(
    { firstName: 'Jean', lastName: 'Dupont', birthDate: '1950-04-12', gender: 'male' },
    [P({ id: 'a', firstName: 'Jean', lastName: 'Dupont', birthDate: '1950-06-01', gender: 'male' })],
  );
  expect(res).toHaveLength(1);
  expect(res[0].score).toBe(100);
  expect(res[0].reasons.sort()).toEqual(['closeBirthYear', 'sameFirstName', 'sameGender', 'sameLastName']);
  expect(isBlocking(res[0].score)).toBe(true);
});

// ---------- Noms seuls : 70 → avertissement (non bloquant) ----------

test('mêmes prénom + nom seulement → score 70 (avertissement)', () => {
  const res = findPotentialDuplicates(
    { firstName: 'Jean', lastName: 'Dupont', gender: 'unknown' },
    [P({ id: 'a', firstName: 'Jean', lastName: 'Dupont', gender: 'unknown' })],
  );
  expect(res).toHaveLength(1);
  expect(res[0].score).toBe(70);
  expect(res[0].reasons.sort()).toEqual(['sameFirstName', 'sameLastName']);
  expect(isBlocking(res[0].score)).toBe(false);
});

// ---------- Accents / casse : la normalisation NFD neutralise les diacritiques ----------

test('normalisation : « Jérôme » == « JEROME » (score de prénom accordé)', () => {
  expect(normalizeName('Jérôme')).toBe('JEROME');
  const res = findPotentialDuplicates(
    { firstName: 'Jérôme', lastName: 'Éléonore' },
    [P({ id: 'a', firstName: 'JEROME', lastName: 'ELEONORE' })],
  );
  expect(res[0].reasons.sort()).toEqual(['sameFirstName', 'sameLastName']);
  expect(res[0].score).toBe(70);
});

// ---------- Frontière ±2 ans sur l'année de naissance ----------

test('année de naissance : ±2 ajoute +20, ±3 non', () => {
  const withinTwo = findPotentialDuplicates(
    { firstName: 'Jean', lastName: 'Dupont', birthDate: '1950-01-01' },
    [P({ id: 'a', firstName: 'Jean', lastName: 'Dupont', birthDate: '1952-12-31' })],
  );
  expect(withinTwo[0].score).toBe(90); // 40 + 30 + 20
  expect(withinTwo[0].reasons).toContain('closeBirthYear');

  const threeApart = findPotentialDuplicates(
    { firstName: 'Jean', lastName: 'Dupont', birthDate: '1950-01-01' },
    [P({ id: 'a', firstName: 'Jean', lastName: 'Dupont', birthDate: '1953-01-01' })],
  );
  expect(threeApart[0].score).toBe(70); // 40 + 30, pas d'année
  expect(threeApart[0].reasons).not.toContain('closeBirthYear');
});

// ---------- Le genre 'unknown' ne compte jamais ----------

test('genre : deux « unknown » n’accordent PAS le +10', () => {
  const res = findPotentialDuplicates(
    { firstName: 'Jean', lastName: 'Dupont', gender: 'unknown' },
    [P({ id: 'a', firstName: 'Jean', lastName: 'Dupont', gender: 'unknown' })],
  );
  expect(res[0].reasons).not.toContain('sameGender');
  expect(res[0].score).toBe(70);
});

// ---------- Sous le seuil : écarté ----------

test('en dessous de 60 (prénom seul) → aucun candidat', () => {
  const res = findPotentialDuplicates(
    { firstName: 'Marie', gender: 'female' },
    [P({ id: 'a', firstName: 'Marie', lastName: 'Autre', gender: 'male' })],
  );
  expect(res).toEqual([]);
});

test('nom seul + année proche = 50 → écarté (< 60)', () => {
  const res = findPotentialDuplicates(
    { lastName: 'Dupont', birthDate: '1950-01-01' },
    [P({ id: 'a', lastName: 'Dupont', birthDate: '1951-01-01' })],
  );
  expect(res).toEqual([]); // 30 + 20 = 50
});

// ---------- Tri décroissant sur plusieurs candidats ----------

test('plusieurs candidats : triés par score décroissant', () => {
  const res = findPotentialDuplicates(
    { firstName: 'Jean', lastName: 'Dupont', birthDate: '1950-01-01', gender: 'male' },
    [
      P({ id: 'weak', firstName: 'Jean', lastName: 'Dupont', gender: 'female' }), // 70
      P({ id: 'strong', firstName: 'Jean', lastName: 'Dupont', birthDate: '1950-01-01', gender: 'male' }), // 100
    ],
  );
  expect(res.map(r => r.person.id)).toEqual(['strong', 'weak']);
  expect(res.map(r => r.score)).toEqual([100, 70]);
});

// ---------- Champs manquants : dégradés proprement (jamais NaN / crash) ----------

test('champs manquants : aucun nom des deux côtés → aucun faux positif', () => {
  const res = findPotentialDuplicates({}, [P({ id: 'a' })]);
  expect(res).toEqual([]);
});

test('un nom vide ne matche jamais un autre nom vide', () => {
  // Prénom identique (+40) mais les deux `lastName` sont vides → aucun +30.
  const res = findPotentialDuplicates(
    { firstName: 'Jean', lastName: '' },
    [P({ id: 'a', firstName: 'Jean', lastName: '' })],
  );
  expect(res).toEqual([]); // 40 < 60 → écarté
});

// ---------- Helpers ----------

test('birthYear : parse l’année, null si absente ou invalide (jamais NaN)', () => {
  expect(birthYear({ birthDate: '1988-05-03' })).toBe(1988);
  expect(birthYear({ birthDate: '1988' })).toBe(1988);
  expect(birthYear({})).toBeNull();
  expect(birthYear({ birthDate: 'n’importe quoi' })).toBeNull();
});

test('isBlocking : seuil à 90', () => {
  expect(isBlocking(89)).toBe(false);
  expect(isBlocking(90)).toBe(true);
  expect(isBlocking(100)).toBe(true);
});
