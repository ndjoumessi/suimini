/**
 * Normalisation et synonymes pour les noms bamiléké / famille TEDA.
 *
 * Les noms bamiléké transcrits en alphabet latin varient beaucoup d'un
 * document à l'autre : accents flottants (FOTIÉ / FOTIE), apostrophes de
 * coup de glotte (TEDA'A), et un « C » prothétique devant certaines
 * consonnes (CFOTIE = FOTIE, le « C » notant une aspiration/click qui
 * disparaît selon le scribe). Ce module rend ces variantes comparables de
 * façon **déterministe** (aucune dépendance externe, aucune donnée cachée).
 *
 * ⚠️ On ne touche PAS aux « C » légitimes (CLAIRE, CHRISTINE, CRISPIN) :
 * le collapse ne s'applique qu'au motif « C + consonne atypique » (voir
 * `collapseProstheticC`).
 */

// Voyelles latines (Y compris) — tout le reste est « consonne ».
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

/**
 * Consonnes qui, après un « C » initial, forment un groupe d'attaque
 * FRANÇAIS/latin parfaitement normal → on NE retire PAS le C.
 *   - CL → CLAIRE, CLÉMENT
 *   - CR → CRISPIN, CRISTELLE
 *   - CH → CHANTAL (et CHOTIE, variante gérée par les synonymes, pas ici)
 * Toute autre consonne après un « C » initial est atypique en français
 * (CF, CT, CD, CN, CM, CB…) et trahit le « C » prothétique bamiléké.
 */
const KEEP_C_BEFORE = new Set(['L', 'R', 'H']);

/**
 * Retire un « C » prothétique en tête d'un mot :
 *   CFOTIE → FOTIE   (C + F : groupe atypique → on retire le C)
 *   CLAIRE → CLAIRE  (C + L : groupe légitime → on garde)
 *   CHOTIE → CHOTIE  (C + H : groupe légitime ici → géré via synonymes)
 *   CAMILLE → CAMILLE (C + voyelle → on garde)
 * Fonctionne mot à mot pour tolérer « CFOTIE Jean ».
 * Entrée attendue : déjà en MAJUSCULES et sans diacritiques.
 */
function collapseProstheticC(word: string): string {
  if (word.length < 2) return word;
  if (word[0] !== 'C') return word;
  const next = word[1];
  // Le C n'est prothétique que devant une consonne « atypique ».
  if (VOWELS.has(next)) return word;           // C + voyelle → vrai C
  if (KEEP_C_BEFORE.has(next)) return word;     // CL / CR / CH → vrai C
  return word.slice(1);                          // CF, CT, CN… → C prothétique
}

/**
 * Normalise un nom bamiléké pour la comparaison :
 *   1. MAJUSCULES
 *   2. suppression des apostrophes (droites et typographiques) → TEDA'A = TEDAA
 *   3. NFD + suppression des diacritiques → FOTIÉ = FOTIE
 *   4. collapse du « C » prothétique par mot → CFOTIE = FOTIE
 *   5. compactage des espaces + trim
 * Déterministe et idempotente.
 */
export function normalizeBamilekeName(s: string): string {
  if (!s) return '';
  const upper = s
    .toUpperCase()
    // apostrophes : droite ', typographique ’, accent grave isolé ` et ʼ modifier
    .replace(/['’`ʼ]/g, '')
    // NFD décompose « É » → « E » + accent combinant, qu'on retire ensuite.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return upper
    .split(/\s+/)
    .filter(Boolean)
    .map(collapseProstheticC)
    .join(' ')
    .trim();
}

/**
 * Synonymes TEDA connus : clé = forme canonique (celle de l'arbre de
 * référence), valeurs = variantes rencontrées dans les documents.
 * Les valeurs sont stockées telles quelles (accents/apostrophes) ;
 * elles sont normalisées à l'usage par `normalizeBamilekeName`.
 */
export const TEDA_SYNONYMS: Record<string, string[]> = {
  FOTIE: ['CFOTIE', 'CHOTIE', 'FOTIÉ'],
  DONGMO: ['DONMO', 'DONGMOE'],
  TSANA: ['SANA', 'TSAN'],
  DJOUMESSI: ['DJOUIMESSI', 'JOUMESSI'],
  TEKEUGUETSOP: ['TEKEUGUETSOB', 'TEKEGUETSOP'],
  TEDA: ["TEDA'A"],
};

/**
 * Index inverse (variante normalisée → canonique normalisée), construit une
 * seule fois. Inclut la canonique elle-même (self-map) pour simplifier les
 * recherches.
 */
const VARIANT_TO_CANON: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canon, variants] of Object.entries(TEDA_SYNONYMS)) {
    const nc = normalizeBamilekeName(canon);
    m.set(nc, nc);
    for (const v of variants) m.set(normalizeBamilekeName(v), nc);
  }
  return m;
})();

/**
 * Renvoie la forme canonique NORMALISÉE d'un nom si c'est une variante
 * connue (SANA → TSANA, CFOTIE → FOTIE), sinon la simple normalisation de
 * l'entrée. Ne suppose jamais que l'entrée est déjà normalisée.
 */
export function canonicalize(name: string): string {
  const n = normalizeBamilekeName(name);
  return VARIANT_TO_CANON.get(n) ?? n;
}

/**
 * Développe un nom en TOUTES ses formes connues (canonique + variantes),
 * normalisées et dédupliquées. Utile pour élargir une requête de recherche :
 * chercher « SANA » interroge aussi « TSANA » et « TSAN ».
 * Si le nom n'a pas de synonyme connu, renvoie [nom normalisé].
 */
export function expandSynonyms(name: string): string[] {
  const canon = canonicalize(name);
  const out = new Set<string>();
  out.add(canon);
  out.add(normalizeBamilekeName(name));
  // Les clés de TEDA_SYNONYMS sont déjà en forme normalisée (MAJ, sans
  // accents ni « C » prothétique) → lookup direct par la canonique.
  // On expose À LA FOIS la forme brute connue (ex. « CFOTIE », « CHOTIE ») ET sa
  // forme normalisée : la brute est l'inventaire des orthographes réelles (tests,
  // affichage, recherche par variante), la normalisée sert au rapprochement
  // exact-synonyme contre les champs déjà normalisés.
  const variants = TEDA_SYNONYMS[canon];
  if (variants) for (const v of variants) { out.add(v); out.add(normalizeBamilekeName(v)); }
  return [...out].filter(Boolean);
}
