import type { FamilyTree, Person } from '@/types';
import { buildGenerationMap, getChildren, getDisplayName, formatYear } from '@/lib/treeUtils';

/**
 * Helpers PURS (aucun réseau, aucun React) pour construire le contexte des récits
 * IA « ciblés » : par génération et par branche. Partagés entre la route
 * `/api/narrative` (server) et `NarrativeModal` (client) — ils doivent donc rester
 * exempts de toute dépendance à `window`, `next/*` ou Anthropic.
 */

export type NarrativeMode = 'full' | 'generation' | 'branch';

// ===== Contexte historique camerounais par époque =====

export interface Era {
  key: 'precolonial' | 'colonial' | 'independence' | 'modern';
  start: number;
  end: number;
  fr: string;
  en: string;
}

/**
 * Grandes périodes de l'histoire du Cameroun, pour ancrer un récit de génération
 * dans son époque. Bornes volontairement larges (les branches se chevauchent aux
 * transitions — normal, une génération enjambe souvent deux périodes).
 */
export const ERAS: Era[] = [
  {
    key: 'precolonial',
    start: 1870,
    end: 1919,
    fr: 'période précoloniale puis protectorat allemand du Kamerun (1884-1916) : royaumes et chefferies, commerce côtier, premières missions',
    en: 'pre-colonial period then German Kamerun protectorate (1884-1916): kingdoms and chiefdoms, coastal trade, first missions',
  },
  {
    key: 'colonial',
    start: 1920,
    end: 1959,
    fr: 'mandat puis tutelle française et britannique (à partir de 1919-1922) : administration coloniale, économie de plantation, montée des mouvements nationalistes et de la résistance (UPC)',
    en: 'French and British mandate then trusteeship (from 1919-1922): colonial administration, plantation economy, rise of nationalist and resistance movements (UPC)',
  },
  {
    key: 'independence',
    start: 1960,
    end: 1979,
    fr: 'indépendance (1960) et construction de la nation : réunification (1961), présidence Ahidjo, exode rural, essor de l\'école',
    en: 'independence (1960) and nation-building: reunification (1961), Ahidjo presidency, rural exodus, spread of schooling',
  },
  {
    key: 'modern',
    start: 1980,
    end: 3000,
    fr: 'Cameroun contemporain : urbanisation, ouverture économique, essor des villes (Douala, Yaoundé) et diaspora mondiale',
    en: 'contemporary Cameroon: urbanization, economic opening, growth of cities (Douala, Yaoundé) and a worldwide diaspora',
  },
];

/** Époques qui recouvrent l'intervalle [minYear, maxYear] (bornes incluses). */
export function erasForRange(minYear: number, maxYear: number): Era[] {
  if (!Number.isFinite(minYear) || !Number.isFinite(maxYear)) return [];
  const lo = Math.min(minYear, maxYear);
  const hi = Math.max(minYear, maxYear);
  return ERAS.filter((e) => e.start <= hi && e.end >= lo);
}

/**
 * Phrase de contexte historique pour un intervalle d'années, dans la locale
 * demandée. Chaîne vide si aucune année n'est connue.
 */
export function eraContext(minYear: number, maxYear: number, locale: 'fr' | 'en' = 'fr'): string {
  const eras = erasForRange(minYear, maxYear);
  if (eras.length === 0) return '';
  return eras.map((e) => (locale === 'en' ? e.en : e.fr)).join(' ; ');
}

// ===== Membres d'une génération =====

/**
 * Personnes appartenant à la génération `gen` (numérotation canonique
 * `buildGenerationMap`). Tri stable par année de naissance puis par nom.
 */
export function buildGenerationMembers(tree: FamilyTree, gen: number): Person[] {
  const genMap = buildGenerationMap(tree);
  return tree.persons
    .filter((p) => genMap.get(p.id) === gen)
    .sort((a, b) => {
      const ya = a.birthDate ? new Date(a.birthDate).getTime() : Number.POSITIVE_INFINITY;
      const yb = b.birthDate ? new Date(b.birthDate).getTime() : Number.POSITIVE_INFINITY;
      if (ya !== yb) return ya - yb;
      return getDisplayName(a).localeCompare(getDisplayName(b));
    });
}

/** Numéros de génération distincts présents dans l'arbre, triés croissant. */
export function generationValues(tree: FamilyTree): number[] {
  const genMap = buildGenerationMap(tree);
  return Array.from(new Set(genMap.values())).sort((a, b) => a - b);
}

// ===== Membres d'une branche (descendance) =====

export interface BranchInfo {
  root: Person;
  /** Racine + toute sa descendance (une seule fois chacun). */
  members: Person[];
  /** Descendance seule (racine exclue). */
  descendants: Person[];
  /** Nombre de générations SOUS la racine (0 si aucun descendant). */
  maxDepth: number;
  /** Arbre textuel indenté, borné, prêt à insérer dans un prompt. */
  textTree: string;
}

const BRANCH_MAX_DEPTH = 8;   // garde-fou anti-boucle / prompt borné
const BRANCH_MAX_LINES = 300; // borne la taille du prompt

function memberLine(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  const dates = b || d ? ` (${b || '?'}${p.isAlive ? '' : '–' + (d || '?')})` : '';
  const place = p.birthPlace?.city ? ` — ${p.birthPlace.city}` : '';
  return `${getDisplayName(p)}${dates}${place}`;
}

/**
 * Branche descendante enracinée sur `rootId` : parcours BFS/DFS via `getChildren`
 * (JAMAIS les parents ni la fratrie), déduplication (un individu peut apparaître
 * sous deux parents), profondeur bornée. Renvoie `null` si la racine est absente.
 */
export function buildBranchMembers(tree: FamilyTree, rootId: string): BranchInfo | null {
  const root = tree.persons.find((p) => p.id === rootId);
  if (!root) return null;

  const { persons, relationships } = tree;
  const seen = new Set<string>([root.id]);
  const descendants: Person[] = [];
  let maxDepth = 0;
  const lines: string[] = [memberLine(root)];

  const walk = (person: Person, depth: number) => {
    if (depth > BRANCH_MAX_DEPTH || lines.length >= BRANCH_MAX_LINES) return;
    const children = getChildren(person.id, relationships, persons);
    for (const child of children) {
      if (seen.has(child.id)) continue; // cycle / diamant → une seule fois
      seen.add(child.id);
      descendants.push(child);
      maxDepth = Math.max(maxDepth, depth);
      if (lines.length < BRANCH_MAX_LINES) {
        lines.push(`${'  '.repeat(depth)}- ${memberLine(child)}`);
      }
      walk(child, depth + 1);
    }
  };
  walk(root, 1);

  return {
    root,
    members: [root, ...descendants],
    descendants,
    maxDepth,
    textTree: lines.join('\n'),
  };
}

// ===== Cache : clé + signature =====

/**
 * Suffixe de clé de cache (mode + cible). Combiné à l'ID de l'arbre côté appelant :
 * `suimini_narrative_${treeId}_${narrativeCacheKey(...)}`.
 */
export function narrativeCacheKey(mode: NarrativeMode, gen?: number | null, rootId?: string | null): string {
  if (mode === 'generation') return `generation_${gen ?? ''}`;
  if (mode === 'branch') return `branch_${rootId ?? ''}`;
  return 'full';
}

/**
 * Signature d'un ensemble de membres : `${nombre}:${max updatedAt}`. Change dès
 * qu'un membre est ajouté/retiré OU qu'un membre est modifié (updatedAt plus
 * récent) → invalide le cache localStorage sans purge globale.
 */
export function narrativeSignature(members: Person[]): string {
  let maxUpdated = '';
  for (const p of members) {
    const u = p.updatedAt || '';
    if (u > maxUpdated) maxUpdated = u;
  }
  return `${members.length}:${maxUpdated}`;
}
