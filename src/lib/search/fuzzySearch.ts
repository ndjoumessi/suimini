/**
 * Recherche de personnes tolérante aux fautes de frappe, réglée pour les
 * variantes de noms bamiléké / TEDA.
 *
 * Deux couches, combinées puis classées :
 *   1. correspondances EXACTES / par PRÉFIXE (littérales ET par synonyme) —
 *      score ~1, toujours en tête ;
 *   2. correspondances APPROCHÉES via Fuse.js (Levenshtein « floue ») avec
 *      élargissement par synonymes (« SANA » retrouve « TSANA »).
 *
 * Fonction pure : aucune dépendance au DOM, à React, au réseau. Testable en
 * isolation (voir e2e/fuzzy-search.spec.ts).
 */
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import type { Person } from '@/types';
import { normalizeBamilekeName, expandSynonyms } from '@/lib/search/bamilekeNames';

export interface PersonMatch {
  /** Champ Fuse ayant matché (firstName / lastName / nickName / bio). */
  key: string;
  /** Fragments surlignables [début, fin] dans la valeur NORMALISÉE du champ. */
  indices: readonly [number, number][];
  value?: string;
}

export interface PersonSearchResult {
  person: Person;
  /** 0 → 1, plus grand = meilleur (1 = exact littéral). */
  score: number;
  /** 'exact' = littéral ou synonyme exact/préfixe ; 'fuzzy' = approché. */
  kind: 'exact' | 'fuzzy';
  matches?: PersonMatch[];
}

const FUSE_KEYS = ['firstName', 'lastName', 'nickName', 'bio'] as const;

// Champs « nom » (hors bio) : servent au passage exact/préfixe.
const NAME_KEYS: (keyof Person)[] = ['firstName', 'lastName', 'nickName'];

const FUSE_OPTIONS: IFuseOptions<Person> = {
  keys: FUSE_KEYS as unknown as string[],
  threshold: 0.35,          // tolère ~1 faute sur un nom court
  ignoreLocation: true,     // la faute peut être n'importe où dans le nom
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  // On indexe et compare sur la forme NORMALISÉE bamiléké : ainsi « FOTIÉ »,
  // « CFOTIE » et « FOTIE » partagent la même clé Fuse.
  getFn: (obj: Person, path: string | string[]): string => {
    const key = Array.isArray(path) ? path[0] : path;
    const raw = (obj as unknown as Record<string, unknown>)[key];
    return typeof raw === 'string' ? normalizeBamilekeName(raw) : '';
  },
};

function normalizedNameFields(p: Person): string[] {
  return NAME_KEYS
    .map(k => p[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map(normalizeBamilekeName)
    .filter(Boolean);
}

/**
 * Recherche classée. EXACT/préfixe d'abord (score décroissant), puis
 * APPROCHÉ (score décroissant). Fonction pure.
 */
export function searchPersons(query: string, persons: Person[]): PersonSearchResult[] {
  const nq = normalizeBamilekeName(query);
  if (!nq) return [];

  // Termes de recherche = requête + toutes ses formes synonymes connues.
  const terms = new Set<string>(expandSynonyms(query));
  terms.add(nq);

  const byId = new Map<string, PersonSearchResult>();

  // ---- Passe 1 : exact / préfixe (littéral + synonyme) ----
  for (const p of persons) {
    const fields = normalizedNameFields(p);
    let best = 0;
    for (const f of fields) {
      if (f === nq) { best = Math.max(best, 1); continue; }                 // exact littéral
      if (nq.length >= 2 && f.startsWith(nq)) { best = Math.max(best, 0.9); continue; } // préfixe littéral
      if (terms.has(f)) { best = Math.max(best, 0.85); continue; }          // synonyme exact (SANA→TSANA)
      // PAS de « préfixe par synonyme » : une variante-troncature courte (ex.
      // « TSAN », synonyme de TSANA) préfixerait « TSANO » et le classerait
      // « exact » à tort. Les rapprochements partiels/fautés d'un synonyme sont
      // captés en passe 2 (Fuse) et donc correctement marqués « approché ».
    }
    if (best > 0) byId.set(p.id, { person: p, score: best, kind: 'exact' });
  }

  // ---- Passe 2 : approché (Fuse), élargi aux synonymes ----
  const fuse = new Fuse(persons, FUSE_OPTIONS);
  for (const term of terms) {
    if (term.length < 2) continue;
    for (const m of fuse.search(term)) {
      const id = m.item.id;
      const existing = byId.get(id);
      if (existing && existing.kind === 'exact') continue; // l'exact prime toujours
      // Fuse : score 0 = parfait → on convertit en 0→1 « plus grand = mieux ».
      const score = 1 - (m.score ?? 1);
      if (!existing || score > existing.score) {
        byId.set(id, {
          person: m.item,
          score,
          kind: 'fuzzy',
          matches: m.matches?.map(mm => ({
            key: String(mm.key ?? ''),
            indices: mm.indices,
            value: mm.value,
          })),
        });
      }
    }
  }

  return [...byId.values()].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'exact' ? -1 : 1;
    return b.score - a.score;
  });
}
