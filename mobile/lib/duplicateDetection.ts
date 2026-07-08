import type { Person } from '@/lib/types';

/**
 * Détection de doublons à l'ajout d'une personne (mobile).
 *
 * Auto-suffisant : `normalizeName` est défini ICI (uppercase + NFD strip
 * diacritiques + trim) — aucun import d'utilitaire de nom d'une autre lib.
 * Miroir de `src/lib/duplicateDetection.ts` (web) ; garder les deux en phase.
 *
 * Score par CHAMP (convention Suimini firstName + lastName) :
 *   - prénom normalisé identique      → +40  ('sameFirstName')
 *   - nom normalisé identique         → +30  ('sameLastName')
 *   - année de naissance à ±2 ans     → +20  ('closeBirthYear')
 *   - même genre (connu, non-unknown) → +10  ('sameGender')
 *
 * Candidats de score >= 60 seulement, triés décroissant.
 * `isBlocking(score)` = quasi-certain (>= 90).
 */

export interface DuplicateMatch {
  person: Person;
  score: number;
  reasons: string[];
}

/** UPPERCASE + suppression des diacritiques (NFD) + trim. '' si vide/absent. */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/** Année de naissance (ISO `AAAA-MM-JJ` ou `AAAA`) → number, ou null. Jamais NaN. */
export function birthYear(p: Partial<Person>): number | null {
  const raw = p.birthDate;
  if (!raw) return null;
  const m = /^\s*(\d{4})/.exec(raw);
  return m ? Number(m[1]) : null;
}

/** Score >= 90 : quasi-certainement un doublon → on bloque l'ajout. */
export function isBlocking(score: number): boolean {
  return score >= 90;
}

const FIRST_NAME_WEIGHT = 40;
const LAST_NAME_WEIGHT = 30;
const BIRTH_YEAR_WEIGHT = 20;
const GENDER_WEIGHT = 10;
const THRESHOLD = 60;
const BIRTH_YEAR_TOLERANCE = 2;

export function findPotentialDuplicates(
  newPerson: Partial<Person>,
  existing: Person[],
): DuplicateMatch[] {
  const nFirst = normalizeName(newPerson.firstName);
  const nLast = normalizeName(newPerson.lastName);
  const nYear = birthYear(newPerson);
  const nGender = newPerson.gender;

  const matches: DuplicateMatch[] = [];

  for (const candidate of existing) {
    let score = 0;
    const reasons: string[] = [];

    const cFirst = normalizeName(candidate.firstName);
    if (nFirst && cFirst && nFirst === cFirst) {
      score += FIRST_NAME_WEIGHT;
      reasons.push('sameFirstName');
    }

    const cLast = normalizeName(candidate.lastName);
    if (nLast && cLast && nLast === cLast) {
      score += LAST_NAME_WEIGHT;
      reasons.push('sameLastName');
    }

    const cYear = birthYear(candidate);
    if (nYear !== null && cYear !== null && Math.abs(nYear - cYear) <= BIRTH_YEAR_TOLERANCE) {
      score += BIRTH_YEAR_WEIGHT;
      reasons.push('closeBirthYear');
    }

    if (
      nGender && candidate.gender &&
      nGender !== 'unknown' && candidate.gender !== 'unknown' &&
      nGender === candidate.gender
    ) {
      score += GENDER_WEIGHT;
      reasons.push('sameGender');
    }

    if (score >= THRESHOLD) {
      matches.push({ person: candidate, score, reasons });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}
