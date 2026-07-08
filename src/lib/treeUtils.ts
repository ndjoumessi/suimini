import { Person, Relationship, FamilyTree, TreeStats, SearchFilters } from '@/types';
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Current UI locale, read from the NEXT_LOCALE cookie on the client.
 * Falls back to the default locale on the server (these display helpers are
 * only used inside client-rendered /app views, so the cookie is available at
 * paint time — no hydration mismatch). Callers may also pass `locale` explicitly.
 */
function currentLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + LOCALE_COOKIE + '=([^;]+)'));
  const value = m ? decodeURIComponent(m[1]) : '';
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// ===== Fuzzy / phonetic search =====

export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Returns a safe http(s) URL or undefined. Blocks dangerous schemes (javascript:,
 * data:, …) to prevent XSS when a user/imported URL is rendered in an href.
 */
export function safeHttpUrl(u?: string): string | undefined {
  if (!u) return undefined;
  const raw = u.trim();
  if (!raw) return undefined;
  // Prepend https:// when no scheme is present so "example.com" still works.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Levenshtein edit distance (number of insertions/deletions/substitutions). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Soundex phonetic code (e.g. "Dupont" and "Dupond" → same code). */
export function soundex(s: string): string {
  const str = normalizeText(s).replace(/[^a-z]/g, '');
  if (!str) return '';
  const codes: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3', l: '4', m: '5', n: '5', r: '6',
  };
  const first = str[0];
  let prev = codes[first] || '';
  let result = first.toUpperCase();
  for (let i = 1; i < str.length && result.length < 4; i++) {
    const code = codes[str[i]] || '';
    if (code && code !== prev) result += code;
    // Vowels (and h/w) reset the "previous" so repeated consonants across them count again
    if ('aeiouy'.includes(str[i])) prev = '';
    else if (str[i] !== 'h' && str[i] !== 'w') prev = code;
  }
  return (result + '000').slice(0, 4);
}

function maxEditDistance(len: number): number {
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

/**
 * Tolerant text match: exact substring, else per-token soundex / Levenshtein.
 * Every whitespace-separated token in `needle` must match some token in `haystack`.
 * Tolerates typos and phonetic variants (e.g. "Dupont" finds "Dupond", "Dupon").
 */
export function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  const hTokens = h.split(/\s+/).filter(Boolean);
  const nTokens = n.split(/\s+/).filter(Boolean);
  return nTokens.every(nt =>
    hTokens.some(ht =>
      ht.includes(nt) ||
      (nt.length >= 3 && soundex(ht) === soundex(nt)) ||
      levenshtein(ht, nt) <= maxEditDistance(nt.length)
    )
  );
}

export function getAge(birthDate?: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = Math.floor((end.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return age >= 0 ? age : null;
}

export function formatDate(dateStr?: string, approx?: boolean, locale?: Locale): string {
  if (!dateStr) return '';
  const loc = locale ?? currentLocale();
  const date = new Date(dateStr);
  const formatted = date.toLocaleDateString(loc === 'en' ? 'en-US' : 'fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  if (!approx) return formatted;
  return loc === 'en' ? `circa ${formatted}` : `vers ${formatted}`;
}

/** Locale-aware age label: "34 ans" / "34 years old". Empty string for a null age. */
export function formatAge(age: number | null, locale?: Locale): string {
  if (age == null) return '';
  const loc = locale ?? currentLocale();
  return loc === 'en' ? `${age} years old` : `${age} ans`;
}

export function formatYear(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

/**
 * Profile completeness as a 0–100 score over six key fields. Shared by the
 * PersonPanel completion donut and the tree node "infos complètes" badge so
 * both agree on what "complete" means.
 */
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
  const parts = [person.firstName, person.maidenName ? `(${person.maidenName})` : null, person.lastName].filter(Boolean);
  return parts.join(' ');
}

export function getDisplayName(person: Person): string {
  // Nom unique autorisé (ex. TEDA, MESSE) : on évite l'espace superflu / "undefined"
  // quand l'un des deux champs est vide.
  return `${person.firstName || ''} ${person.lastName || ''}`.trim();
}

export function getParents(personId: string, relationships: Relationship[], persons: Person[]): Person[] {
  const parentRels = relationships.filter(
    r => r.type === 'parent' && r.person2Id === personId
  );
  return parentRels
    .map(r => persons.find(p => p.id === r.person1Id))
    .filter(Boolean) as Person[];
}

export function getChildren(personId: string, relationships: Relationship[], persons: Person[]): Person[] {
  const childRels = relationships.filter(
    r => r.type === 'parent' && r.person1Id === personId
  );
  return childRels
    .map(r => persons.find(p => p.id === r.person2Id))
    .filter(Boolean) as Person[];
}

export function getSpouses(personId: string, relationships: Relationship[], persons: Person[]): Person[] {
  const spouseRels = relationships.filter(
    r => (r.type === 'spouse' || r.type === 'partner') &&
      (r.person1Id === personId || r.person2Id === personId)
  );
  return spouseRels
    .map(r => persons.find(p => p.id === (r.person1Id === personId ? r.person2Id : r.person1Id)))
    .filter(Boolean) as Person[];
}

export function getSiblings(personId: string, relationships: Relationship[], persons: Person[]): Person[] {
  const parents = getParents(personId, relationships, persons);
  if (parents.length === 0) return [];
  
  const siblingIds = new Set<string>();
  parents.forEach(parent => {
    const children = getChildren(parent.id, relationships, persons);
    children.forEach(child => {
      if (child.id !== personId) siblingIds.add(child.id);
    });
  });
  
  return Array.from(siblingIds)
    .map(id => persons.find(p => p.id === id))
    .filter(Boolean) as Person[];
}

export function getGeneration(personId: string, relationships: Relationship[], persons: Person[], memo: Map<string, number> = new Map()): number {
  if (memo.has(personId)) return memo.get(personId)!;
  
  const parents = getParents(personId, relationships, persons);
  if (parents.length === 0) {
    memo.set(personId, 0);
    return 0;
  }
  
  const maxParentGen = Math.max(...parents.map(p => getGeneration(p.id, relationships, persons, memo)));
  const gen = maxParentGen + 1;
  memo.set(personId, gen);
  return gen;
}

/**
 * Génération canonique par personne — DÉTERMINISTE pour tout l'arbre, indépendante
 * du focus/pivot affiché : BFS depuis la racine (rootPersonId) où enfant = +1,
 * parent = −1, conjoint = même génération, puis normalisation pour que l'ancêtre le
 * plus ancien = 0. Source unique utilisée par l'arbre, le tableau de bord et le
 * panneau → un membre a TOUJOURS le même numéro de génération partout.
 * (Les personnes isolées, hors du composant relié à la racine, restent à 0.)
 */
export function buildGenerationMap(tree: FamilyTree): Map<string, number> {
  const { persons, relationships } = tree;
  const gen = new Map<string, number>();
  const start = (tree.rootPersonId && persons.some(p => p.id === tree.rootPersonId))
    ? tree.rootPersonId : persons[0]?.id;
  if (!start) return gen;
  gen.set(start, 0);
  const queue: string[] = [start];
  while (queue.length) {
    const id = queue.shift()!;
    const g = gen.get(id)!;
    for (const c of getChildren(id, relationships, persons)) if (!gen.has(c.id)) { gen.set(c.id, g + 1); queue.push(c.id); }
    for (const par of getParents(id, relationships, persons)) if (!gen.has(par.id)) { gen.set(par.id, g - 1); queue.push(par.id); }
    for (const sp of getSpouses(id, relationships, persons)) if (!gen.has(sp.id)) { gen.set(sp.id, g); queue.push(sp.id); }
  }
  let min = Infinity;
  for (const v of gen.values()) min = Math.min(min, v);
  if (min !== 0 && Number.isFinite(min)) for (const [k, v] of gen) gen.set(k, v - min);
  return gen;
}

export function computeTreeStats(tree: FamilyTree): TreeStats {
  const { persons, relationships } = tree;
  
  const alive = persons.filter(p => p.isAlive);
  const deceased = persons.filter(p => !p.isAlive);
  
  // Calculate lifespans
  const lifespans = deceased
    .map(p => getAge(p.birthDate, p.deathDate))
    .filter((a): a is number => a !== null);
  
  const avgLifespan = lifespans.length > 0
    ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
    : undefined;

  // Oldest alive
  const oldestAlive = alive
    .filter(p => p.birthDate)
    .sort((a, b) => new Date(a.birthDate!).getTime() - new Date(b.birthDate!).getTime())[0];

  // Youngest
  const youngest = alive
    .filter(p => p.birthDate)
    .sort((a, b) => new Date(b.birthDate!).getTime() - new Date(a.birthDate!).getTime())[0];

  // Most common surname
  const surnameCounts: Record<string, number> = {};
  persons.forEach(p => {
    surnameCounts[p.lastName] = (surnameCounts[p.lastName] || 0) + 1;
  });
  const mostCommonSurname = Object.entries(surnameCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Generations
  const memo = new Map<string, number>();
  const gens = persons.map(p => getGeneration(p.id, relationships, persons, memo));
  const totalGenerations = gens.length ? Math.max(...gens) + 1 : 0;

  const totalPhotos = persons.filter(p => p.profilePhoto || (p.photos && p.photos.length > 0)).length;
  const totalEvents = persons.reduce((acc, p) => acc + (p.events?.length || 0), 0);

  return {
    totalPersons: persons.length,
    totalMales: persons.filter(p => p.gender === 'male').length,
    totalFemales: persons.filter(p => p.gender === 'female').length,
    totalAlive: alive.length,
    totalDeceased: deceased.length,
    totalGenerations,
    oldestPerson: oldestAlive,
    youngestPerson: youngest,
    averageLifespan: avgLifespan,
    mostCommonSurname,
    totalRelationships: relationships.length,
    totalPhotos,
    totalEvents,
  };
}

export function searchPersons(persons: Person[], filters: SearchFilters): Person[] {
  return persons.filter(person => {
    if (filters.query) {
      const q = filters.query;
      // Fuzzy/phonetic match on names (typo & variant tolerant), substring on bio/occupation.
      const nameHay = `${getFullName(person)} ${person.nickName || ''}`;
      const extra = normalizeText(`${person.bio || ''} ${person.occupation || ''}`);
      if (!fuzzyMatch(nameHay, q) && !extra.includes(normalizeText(q))) {
        return false;
      }
    }
    
    if (filters.gender && person.gender !== filters.gender) return false;
    if (filters.isAlive !== undefined && person.isAlive !== filters.isAlive) return false;
    if (filters.hasPhoto && !person.profilePhoto) return false;
    if (filters.occupation) {
      if (!(person.occupation || '').toLowerCase().includes(filters.occupation.toLowerCase())) {
        return false;
      }
    }
    
    if (filters.birthYearFrom && person.birthDate) {
      if (new Date(person.birthDate).getFullYear() < filters.birthYearFrom) return false;
    }
    if (filters.birthYearTo && person.birthDate) {
      if (new Date(person.birthDate).getFullYear() > filters.birthYearTo) return false;
    }
    
    if (filters.birthPlace && person.birthPlace) {
      const place = [person.birthPlace.city, person.birthPlace.region, person.birthPlace.country]
        .filter(Boolean).join(' ').toLowerCase();
      if (!place.includes(filters.birthPlace.toLowerCase())) return false;
    }
    
    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some(tag => person.tags?.includes(tag))) return false;
    }
    
    return true;
  });
}

interface GedFamily {
  id: string;
  husbandId?: string;
  wifeId?: string;
  childIds: string[];
  marriage?: { date?: string; place?: string };
}

/** Group a tree's couples and parent-child links into GEDCOM-style FAM records. */
function buildGedFamilies(tree: FamilyTree): GedFamily[] {
  const { persons, relationships } = tree;
  const byId = new Map(persons.map(p => [p.id, p]));
  const families: GedFamily[] = [];
  const byKey = new Map<string, GedFamily>();
  let counter = 0;
  const partnerKey = (a?: string, b?: string) => [a, b].filter(Boolean).sort().join('&');

  function assignRoles(ids: string[]): { husbandId?: string; wifeId?: string } {
    const ps = ids.map(id => byId.get(id)).filter((p): p is Person => !!p);
    let husbandId = ps.find(p => p.gender === 'male')?.id;
    let wifeId = ps.find(p => p.gender === 'female')?.id;
    const remaining = ids.filter(id => id !== husbandId && id !== wifeId);
    if (!husbandId) husbandId = remaining.shift();
    if (!wifeId) wifeId = remaining.shift();
    return { husbandId, wifeId };
  }

  // Couples (spouse / partner) — preserved even when childless.
  relationships.filter(r => r.type === 'spouse' || r.type === 'partner').forEach(r => {
    const { husbandId, wifeId } = assignRoles([r.person1Id, r.person2Id]);
    const key = partnerKey(husbandId, wifeId);
    if (byKey.has(key)) return;
    const date = r.startDate || r.marriageEvent?.date;
    const fam: GedFamily = {
      id: `F${++counter}`, husbandId, wifeId, childIds: [],
      marriage: (date || r.marriageEvent?.place?.city) ? { date, place: r.marriageEvent?.place?.city } : undefined,
    };
    byKey.set(key, fam);
    families.push(fam);
  });

  // Children grouped by their set of parents (merges into the couple's family when it exists).
  persons.forEach(child => {
    const parentIds = getParents(child.id, relationships, persons).map(p => p.id);
    if (parentIds.length === 0) return;
    const { husbandId, wifeId } = assignRoles(parentIds);
    const key = partnerKey(husbandId, wifeId);
    let fam = byKey.get(key);
    if (!fam) {
      fam = { id: `F${++counter}`, husbandId, wifeId, childIds: [] };
      byKey.set(key, fam);
      families.push(fam);
    }
    if (!fam.childIds.includes(child.id)) fam.childIds.push(child.id);
  });

  return families;
}

/**
 * Strip CR/LF (and collapse surrounding whitespace) from a single-line GEDCOM
 * value (NAME/PLAC/OCCU/NICK…) so an embedded newline can never break the
 * level/tag line structure. Multi-line text (bio) goes through gedNoteLines instead.
 */
function gedSanitize(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Max length of a GEDCOM 5.5.1 line value before it must be split with CONC. */
const GED_MAX_VALUE = 248;

/**
 * Emit a `1 NOTE` block for multi-line text using GEDCOM 5.5.1 continuations:
 * every logical line (split on \n) becomes a CONT sub-line; a logical line longer
 * than GED_MAX_VALUE chars is wrapped across CONC sub-lines. The first logical
 * line's first chunk rides on the `1 NOTE` tag itself (per the 5.5.1 spec).
 */
function gedNoteLines(text: string): string[] {
  const out: string[] = [];
  const logicalLines = text.replace(/\r\n?/g, '\n').split('\n');
  logicalLines.forEach((logical, li) => {
    // Split one logical line into <=GED_MAX_VALUE chunks (first chunk keeps the tag).
    const chunks: string[] = [];
    let rest = logical;
    do {
      chunks.push(rest.slice(0, GED_MAX_VALUE));
      rest = rest.slice(GED_MAX_VALUE);
    } while (rest.length > 0);
    chunks.forEach((chunk, ci) => {
      if (li === 0 && ci === 0) out.push(`1 NOTE ${chunk}`);
      else if (ci === 0) out.push(`2 CONT ${chunk}`);   // new logical line
      else out.push(`2 CONC ${chunk}`);                 // continuation of a long line
    });
  });
  return out;
}

export function exportGEDCOM(tree: FamilyTree): string {
  const lines: string[] = [];
  lines.push('0 HEAD');
  lines.push('1 SOUR Suimini');
  lines.push('2 NAME Suimini Family Memory');
  lines.push('2 VERS 1.0');
  lines.push('1 DEST ANY');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push(`1 FILE ${gedSanitize(tree.name)}`);
  lines.push(`1 DATE ${formatGEDDate(new Date().toISOString())}`);
  lines.push('1 CHAR UTF-8');

  const families = buildGedFamilies(tree);
  const fams = new Map<string, string[]>(); // person → families as a partner
  const famc = new Map<string, string[]>(); // person → family as a child
  families.forEach(f => {
    [f.husbandId, f.wifeId].forEach(id => {
      if (!id) return;
      const arr = fams.get(id) || []; arr.push(f.id); fams.set(id, arr);
    });
    f.childIds.forEach(id => {
      const arr = famc.get(id) || []; arr.push(f.id); famc.set(id, arr);
    });
  });

  tree.persons.forEach(person => {
    lines.push(`0 @${person.id}@ INDI`);
    // NOTE: keep the "firstName /lastName/" order verbatim. The TEDA convention of
    // storing the surname in firstName is a per-tree DATA-ENTRY choice, not a global
    // export rule — inverting here would corrupt every non-TEDA tree.
    lines.push(`1 NAME ${gedSanitize(person.firstName || '')} /${gedSanitize(person.lastName || '')}/`);
    if (person.firstName) lines.push(`2 GIVN ${gedSanitize(person.firstName)}`);
    if (person.lastName) lines.push(`2 SURN ${gedSanitize(person.lastName)}`);
    if (person.nickName) lines.push(`2 NICK ${gedSanitize(person.nickName)}`);
    if (person.maidenName) lines.push(`2 NPFX ${gedSanitize(person.maidenName)}`);
    if (person.gender === 'male') lines.push('1 SEX M');
    else if (person.gender === 'female') lines.push('1 SEX F');

    if (person.birthDate) {
      lines.push('1 BIRT');
      lines.push(`2 DATE ${formatGEDDate(person.birthDate)}`);
      if (person.birthPlace?.city) lines.push(`2 PLAC ${gedSanitize(person.birthPlace.city)}`);
    }
    if (person.deathDate) {
      lines.push('1 DEAT');
      lines.push(`2 DATE ${formatGEDDate(person.deathDate)}`);
      if (person.deathPlace?.city) lines.push(`2 PLAC ${gedSanitize(person.deathPlace.city)}`);
    }
    if (person.occupation) lines.push(`1 OCCU ${gedSanitize(person.occupation)}`);
    if (person.bio && person.bio.trim()) lines.push(...gedNoteLines(person.bio));
    (fams.get(person.id) || []).forEach(fid => lines.push(`1 FAMS @${fid}@`));
    (famc.get(person.id) || []).forEach(fid => lines.push(`1 FAMC @${fid}@`));
  });

  // Family records: HUSB / WIFE / CHIL + marriage event
  families.forEach(f => {
    lines.push(`0 @${f.id}@ FAM`);
    if (f.husbandId) lines.push(`1 HUSB @${f.husbandId}@`);
    if (f.wifeId) lines.push(`1 WIFE @${f.wifeId}@`);
    f.childIds.forEach(cid => lines.push(`1 CHIL @${cid}@`));
    if (f.marriage) {
      lines.push('1 MARR');
      if (f.marriage.date) lines.push(`2 DATE ${formatGEDDate(f.marriage.date)}`);
      if (f.marriage.place) lines.push(`2 PLAC ${gedSanitize(f.marriage.place)}`);
    }
  });

  lines.push('0 TRLR');
  // GEDCOM 5.5.1 mandates CRLF line terminators.
  return lines.join('\r\n');
}

function formatGEDDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

interface GedFamRecord {
  husbandId?: string;
  wifeId?: string;
  childIds: string[];
  marrDate?: string;
  marrPlace?: string;
}

export function importGEDCOM(content: string): Partial<FamilyTree> {
  const persons: Person[] = [];
  const relationships: Relationship[] = [];
  const famRecords: GedFamRecord[] = [];
  const lines = content.split(/\r?\n/);

  let currentPerson: Partial<Person> | null = null as Partial<Person> | null;
  let currentFam: GedFamRecord | null = null as GedFamRecord | null;
  let context: 'birt' | 'deat' | 'marr' | null = null;
  const xref = (v: string) => v.replace(/@/g, '').trim();

  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2 || Number.isNaN(parseInt(parts[0]))) return;
    const level = parseInt(parts[0]);
    const tag = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === 0) {
      if (currentPerson?.id) persons.push(currentPerson as Person);
      if (currentFam) famRecords.push(currentFam);
      currentPerson = null;
      currentFam = null;
      context = null;

      if (tag?.startsWith('@') && parts[2] === 'INDI') {
        currentPerson = {
          id: xref(tag), firstName: '', lastName: '', gender: 'unknown', isAlive: true,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
      } else if (tag?.startsWith('@') && parts[2] === 'FAM') {
        currentFam = { childIds: [] };
      }
      return;
    }

    // A new level-1 record clears any sub-record context (BIRT/DEAT/MARR re-set it below).
    if (level === 1) context = null;

    if (currentPerson) {
      switch (tag) {
        case 'NAME': {
          const m = value.match(/^(.*?)\s*\/(.*?)\//);
          if (m) { currentPerson.firstName = m[1].trim(); currentPerson.lastName = m[2].trim(); }
          else currentPerson.firstName = value.trim();
          break;
        }
        case 'GIVN': if (!currentPerson.firstName) currentPerson.firstName = value.trim(); break;
        case 'SURN': if (!currentPerson.lastName) currentPerson.lastName = value.trim(); break;
        case 'NPFX': currentPerson.maidenName = value.trim(); break;
        case 'SEX': currentPerson.gender = value === 'M' ? 'male' : value === 'F' ? 'female' : 'unknown'; break;
        case 'BIRT': context = 'birt'; break;
        case 'DEAT': context = 'deat'; currentPerson.isAlive = false; break;
        case 'OCCU': currentPerson.occupation = value; break;
        case 'DATE':
          if (context === 'birt') currentPerson.birthDate = parseGEDDate(value);
          else if (context === 'deat') currentPerson.deathDate = parseGEDDate(value);
          break;
        case 'PLAC':
          if (context === 'birt') currentPerson.birthPlace = { city: value };
          else if (context === 'deat') currentPerson.deathPlace = { city: value };
          break;
      }
    } else if (currentFam) {
      switch (tag) {
        case 'HUSB': currentFam.husbandId = xref(value); break;
        case 'WIFE': currentFam.wifeId = xref(value); break;
        case 'CHIL': currentFam.childIds.push(xref(value)); break;
        case 'MARR': context = 'marr'; break;
        case 'DATE': if (context === 'marr') currentFam.marrDate = parseGEDDate(value); break;
        case 'PLAC': if (context === 'marr') currentFam.marrPlace = value; break;
      }
    }
  });
  if (currentPerson?.id) persons.push(currentPerson as Person);
  if (currentFam) famRecords.push(currentFam);

  // Reconstruct all relationships from the family records.
  const personIds = new Set(persons.map(p => p.id));
  famRecords.forEach(f => {
    const parents = [f.husbandId, f.wifeId].filter((id): id is string => !!id && personIds.has(id));
    if (parents.length === 2) {
      relationships.push({
        id: generateId(), type: 'spouse', person1Id: parents[0], person2Id: parents[1],
        startDate: f.marrDate, isActive: true,
        marriageEvent: (f.marrDate || f.marrPlace)
          ? { id: generateId(), type: 'marriage', date: f.marrDate, place: f.marrPlace ? { city: f.marrPlace } : undefined }
          : undefined,
      });
    }
    f.childIds.filter(cid => personIds.has(cid)).forEach(cid => {
      parents.forEach(pid => {
        relationships.push({ id: generateId(), type: 'parent', person1Id: pid, person2Id: cid });
      });
    });
  });

  return { persons, relationships };
}

function parseGEDDate(gedDate: string): string {
  const months: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  const parts = gedDate.split(' ');
  if (parts.length === 3) {
    return `${parts[2]}-${months[parts[1]] || '01'}-${parts[0].padStart(2, '0')}`;
  }
  return gedDate;
}

// --- Ancestor / Descendant helpers ---

export function getAllAncestors(personId: string, relationships: Relationship[], persons: Person[]): Person[] {
  const visited = new Set<string>();
  const result: Person[] = [];
  
  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const parents = getParents(id, relationships, persons);
    parents.forEach(p => {
      result.push(p);
      walk(p.id);
    });
  }
  walk(personId);
  return result;
}

export function getAllDescendants(personId: string, relationships: Relationship[], persons: Person[]): Person[] {
  const visited = new Set<string>();
  const result: Person[] = [];
  
  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const children = getChildren(id, relationships, persons);
    children.forEach(c => {
      result.push(c);
      walk(c.id);
    });
  }
  walk(personId);
  return result;
}

export function findCommonAncestors(id1: string, id2: string, relationships: Relationship[], persons: Person[]): Person[] {
  const ancestors1 = new Set(getAllAncestors(id1, relationships, persons).map(p => p.id));
  const ancestors2 = getAllAncestors(id2, relationships, persons);
  return ancestors2.filter(p => ancestors1.has(p.id));
}

export function findRelationPath(fromId: string, toId: string, relationships: Relationship[], persons: Person[]): string[] | null {
  // BFS
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];
  const visited = new Set<string>([fromId]);
  
  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === toId) return path;
    if (path.length > 8) continue; // limit depth
    
    const neighbors = [
      ...getParents(id, relationships, persons),
      ...getChildren(id, relationships, persons),
      ...getSpouses(id, relationships, persons),
      ...getSiblings(id, relationships, persons),
    ];
    
    for (const n of neighbors) {
      if (!visited.has(n.id)) {
        visited.add(n.id);
        queue.push({ id: n.id, path: [...path, n.id] });
      }
    }
  }
  return null;
}

export function describeRelation(fromId: string, toId: string, path: string[], relationships: Relationship[], persons: Person[], locale?: Locale): string {
  const en = (locale ?? currentLocale()) === 'en';
  if (path.length < 2) return en ? 'Same person' : 'Même personne';
  if (path.length === 2) {
    const parents = getParents(fromId, relationships, persons);
    const children = getChildren(fromId, relationships, persons);
    const spouses = getSpouses(fromId, relationships, persons);
    const siblings = getSiblings(fromId, relationships, persons);

    if (parents.some(p => p.id === toId)) return en ? 'Parent' : 'Parent';
    if (children.some(c => c.id === toId)) return en ? 'Child' : 'Enfant';
    if (spouses.some(s => s.id === toId)) return en ? 'Spouse' : 'Conjoint(e)';
    if (siblings.some(s => s.id === toId)) return en ? 'Sibling' : 'Frère / Sœur';
  }
  if (path.length === 3) {
    const grandparents = getParents(path[1], relationships, persons);
    if (grandparents.some(p => p.id === toId)) return en ? 'Grandparent' : 'Grand-parent';
    const grandchildren = getChildren(path[1], relationships, persons);
    if (grandchildren.some(c => c.id === toId)) return en ? 'Grandchild' : 'Petit-enfant';
    return en ? 'Cousin / Uncle / Aunt' : 'Cousin(e) / Oncle / Tante';
  }
  if (path.length === 4) return en ? 'Great-grandparent or distant cousin' : 'Arrière-grand-parent ou cousin(e) éloigné(e)';
  return en ? `Family link (${path.length - 1} degrees)` : `Lien familial (${path.length - 1} degrés)`;
}

// --- Anniversaries ---
export function getUpcomingAnniversaries(persons: Person[], relationships: Relationship[], daysAhead = 365): import('@/types').Anniversary[] {
  const today = new Date();
  today.setHours(0,0,0,0);
  const results: import('@/types').Anniversary[] = [];

  persons.forEach(person => {
    // Birthday
    if (person.birthDate && person.isAlive) {
      const birth = new Date(person.birthDate);
      const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
      let diff = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
      if (diff < 0) diff += 365;
      if (diff <= daysAhead) {
        results.push({
          person,
          type: 'birthday',
          date: person.birthDate,
          age: today.getFullYear() - birth.getFullYear() + (diff === 0 ? 0 : 1),
          daysUntil: diff,
        });
      }
    }
    
    // Anniversary / death commemoration
    if (person.deathDate) {
      const death = new Date(person.deathDate);
      const thisYear = new Date(today.getFullYear(), death.getMonth(), death.getDate());
      let diff = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
      if (diff < 0) diff += 365;
      if (diff <= daysAhead) {
        results.push({
          person,
          type: 'deathday',
          date: person.deathDate,
          daysUntil: diff,
        });
      }
    }
  });

  // Weddings
  relationships.filter(r => r.type === 'spouse' && r.startDate && r.isActive).forEach(rel => {
    const p1 = persons.find(p => p.id === rel.person1Id);
    const p2 = persons.find(p => p.id === rel.person2Id);
    if (!p1 || !p2 || !rel.startDate) return;
    
    const wedding = new Date(rel.startDate);
    const thisYear = new Date(today.getFullYear(), wedding.getMonth(), wedding.getDate());
    let diff = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
    if (diff < 0) diff += 365;
    if (diff <= daysAhead) {
      results.push({
        person: p1,
        type: 'wedding',
        date: rel.startDate,
        daysUntil: diff,
        relatedPerson: p2,
        age: today.getFullYear() - wedding.getFullYear() + (diff === 0 ? 0 : 1),
      });
    }
  });

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}
