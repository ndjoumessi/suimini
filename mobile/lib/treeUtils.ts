/**
 * Genealogy helpers — ported from the web app's src/lib/treeUtils.ts.
 * Kept dependency-free so it runs identically on device.
 */
import type {
  Person,
  Relationship,
  FamilyTree,
  TreeStats,
  Anniversary,
} from './types';
import { currentLanguage } from './i18n';

export function generateId(): string {
  return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function getAge(birthDate?: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = Math.floor(
    (end.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  return age >= 0 ? age : null;
}

export function formatDate(dateStr?: string, approx?: boolean): string {
  if (!dateStr) return '';
  const en = currentLanguage() === 'en';
  const date = new Date(dateStr);
  const formatted = date.toLocaleDateString(en ? 'en-US' : 'fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  if (!approx) return formatted;
  return en ? `circa ${formatted}` : `vers ${formatted}`;
}

export function formatAge(age: number | null): string {
  if (age == null) return '';
  return currentLanguage() === 'en' ? `${age} years` : `${age} ans`;
}

export function formatYear(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

/** Profile completeness as a 0–100 score over six key fields. */
export function personCompleteness(p: Person): number {
  const checks = [
    !!p.profilePhoto,
    !!p.birthDate,
    !!p.birthPlace?.city,
    p.isAlive || !!p.deathDate,
    !!p.occupation,
    !!(p.bio && p.bio.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function getFullName(person: Person): string {
  return [
    person.firstName,
    person.maidenName ? `(${person.maidenName})` : null,
    person.lastName,
  ]
    .filter(Boolean)
    .join(' ');
}

export function getDisplayName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
}

export function getInitials(person: Person): string {
  const a = person.firstName?.[0] ?? '';
  const b = person.lastName?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

export function getParents(
  personId: string,
  relationships: Relationship[],
  persons: Person[],
): Person[] {
  return relationships
    .filter((r) => r.type === 'parent' && r.person2Id === personId)
    .map((r) => persons.find((p) => p.id === r.person1Id))
    .filter(Boolean) as Person[];
}

export function getChildren(
  personId: string,
  relationships: Relationship[],
  persons: Person[],
): Person[] {
  return relationships
    .filter((r) => r.type === 'parent' && r.person1Id === personId)
    .map((r) => persons.find((p) => p.id === r.person2Id))
    .filter(Boolean) as Person[];
}

export function getSpouses(
  personId: string,
  relationships: Relationship[],
  persons: Person[],
): Person[] {
  return relationships
    .filter(
      (r) =>
        (r.type === 'spouse' || r.type === 'partner') &&
        (r.person1Id === personId || r.person2Id === personId),
    )
    .map((r) =>
      persons.find(
        (p) => p.id === (r.person1Id === personId ? r.person2Id : r.person1Id),
      ),
    )
    .filter(Boolean) as Person[];
}

export function getSiblings(
  personId: string,
  relationships: Relationship[],
  persons: Person[],
): Person[] {
  const parents = getParents(personId, relationships, persons);
  if (parents.length === 0) return [];
  const siblingIds = new Set<string>();
  parents.forEach((parent) => {
    getChildren(parent.id, relationships, persons).forEach((child) => {
      if (child.id !== personId) siblingIds.add(child.id);
    });
  });
  return Array.from(siblingIds)
    .map((id) => persons.find((p) => p.id === id))
    .filter(Boolean) as Person[];
}

export function getGeneration(
  personId: string,
  relationships: Relationship[],
  persons: Person[],
  memo: Map<string, number> = new Map(),
  visiting: Set<string> = new Set(),
): number {
  if (memo.has(personId)) return memo.get(personId)!;
  if (visiting.has(personId)) return 0; // cycle guard — see spouse fallback below

  const parents = getParents(personId, relationships, persons);
  if (parents.length > 0) {
    visiting.add(personId);
    const maxParentGen = Math.max(
      ...parents.map((p) => getGeneration(p.id, relationships, persons, memo, visiting)),
    );
    visiting.delete(personId);
    const gen = maxParentGen + 1;
    memo.set(personId, gen);
    return gen;
  }

  // No recorded parents — either a genuine root ancestor, or (far more
  // common in a real, partially-documented family tree) a spouse who
  // married in without their own ancestry on file. Defaulting those straight
  // to 0 collapsed every such spouse onto the founders' row regardless of
  // which generation they actually married into — their children (whose
  // OTHER parent sits many rows down) then got a parent→child edge spanning
  // the tree's full height, which is what turned the "Arbre" view into a
  // dense diagonal crosshatch on any tree with real intermarriage. Anchoring
  // on a spouse/partner's generation instead keeps couples on the same row.
  // A spouse pair who are BOTH rootless (e.g. the founding couple) still
  // falls through to 0 via the cycle guard above.
  visiting.add(personId);
  const spouseGens = getSpouses(personId, relationships, persons).map((s) =>
    getGeneration(s.id, relationships, persons, memo, visiting),
  );
  visiting.delete(personId);
  const gen = spouseGens.length ? Math.max(...spouseGens) : 0;
  memo.set(personId, gen);
  return gen;
}

export function computeTreeStats(tree: FamilyTree): TreeStats {
  const { persons, relationships } = tree;
  const alive = persons.filter((p) => p.isAlive);
  const deceased = persons.filter((p) => !p.isAlive);

  const lifespans = deceased
    .map((p) => getAge(p.birthDate, p.deathDate))
    .filter((a): a is number => a !== null);
  const avgLifespan = lifespans.length
    ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
    : undefined;

  const oldestAlive = alive
    .filter((p) => p.birthDate)
    .sort(
      (a, b) =>
        new Date(a.birthDate!).getTime() - new Date(b.birthDate!).getTime(),
    )[0];
  const youngest = alive
    .filter((p) => p.birthDate)
    .sort(
      (a, b) =>
        new Date(b.birthDate!).getTime() - new Date(a.birthDate!).getTime(),
    )[0];

  const surnameCounts: Record<string, number> = {};
  persons.forEach((p) => {
    surnameCounts[p.lastName] = (surnameCounts[p.lastName] || 0) + 1;
  });
  const mostCommonSurname = Object.entries(surnameCounts).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  const memo = new Map<string, number>();
  const gens = persons.map((p) =>
    getGeneration(p.id, relationships, persons, memo),
  );
  const totalGenerations = gens.length ? Math.max(...gens) + 1 : 0;

  return {
    totalPersons: persons.length,
    totalMales: persons.filter((p) => p.gender === 'male').length,
    totalFemales: persons.filter((p) => p.gender === 'female').length,
    totalAlive: alive.length,
    totalDeceased: deceased.length,
    totalGenerations,
    oldestPerson: oldestAlive,
    youngestPerson: youngest,
    averageLifespan: avgLifespan,
    mostCommonSurname,
    totalRelationships: relationships.length,
    totalPhotos: persons.filter(
      (p) => p.profilePhoto || (p.photos && p.photos.length > 0),
    ).length,
    totalEvents: persons.reduce((acc, p) => acc + (p.events?.length || 0), 0),
  };
}

/** Free-text search over name / occupation / birthplace. */
export function searchPersons(persons: Person[], query: string): Person[] {
  const q = normalizeText(query);
  if (!q) return persons;
  return persons.filter((p) => {
    const hay = normalizeText(
      [
        p.firstName,
        p.lastName,
        p.maidenName ?? '',
        p.occupation ?? '',
        p.birthPlace?.city ?? '',
      ].join(' '),
    );
    return hay.includes(q);
  });
}

/** Upcoming birthdays / death anniversaries within `daysAhead`. */
export function getUpcomingAnniversaries(
  persons: Person[],
  daysAhead = 365,
): Anniversary[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: Anniversary[] = [];

  const push = (
    person: Person,
    type: Anniversary['type'],
    dateStr?: string,
  ) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    const daysUntil = Math.round(
      (next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (daysUntil > daysAhead) return;
    out.push({
      person,
      type,
      date: dateStr,
      age: next.getFullYear() - d.getFullYear(),
      daysUntil,
    });
  };

  persons.forEach((p) => {
    if (p.isAlive) push(p, 'birthday', p.birthDate);
    else push(p, 'deathday', p.deathDate);
  });

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
