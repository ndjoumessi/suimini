import { Person, Relationship, FamilyTree, TreeStats, SearchFilters } from '@/types';

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function getAge(birthDate?: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = Math.floor((end.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return age >= 0 ? age : null;
}

export function formatDate(dateStr?: string, approx?: boolean): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const formatted = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  return approx ? `vers ${formatted}` : formatted;
}

export function formatYear(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

export function getFullName(person: Person): string {
  const parts = [person.firstName, person.maidenName ? `(${person.maidenName})` : null, person.lastName].filter(Boolean);
  return parts.join(' ');
}

export function getDisplayName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
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
  const totalGenerations = Math.max(...gens) + 1;

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
      const q = filters.query.toLowerCase();
      const fullName = getFullName(person).toLowerCase();
      const bio = (person.bio || '').toLowerCase();
      const occupation = (person.occupation || '').toLowerCase();
      if (!fullName.includes(q) && !bio.includes(q) && !occupation.includes(q)) {
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

export function exportGEDCOM(tree: FamilyTree): string {
  const lines: string[] = [];
  lines.push('0 HEAD');
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push(`1 FILE ${tree.name}`);
  lines.push(`1 DATE ${new Date().toLocaleDateString('fr-FR')}`);
  lines.push('1 CHAR UTF-8');

  tree.persons.forEach(person => {
    lines.push(`0 @${person.id}@ INDI`);
    lines.push(`1 NAME ${person.firstName} /${person.lastName}/`);
    lines.push(`2 GIVN ${person.firstName}`);
    lines.push(`2 SURN ${person.lastName}`);
    if (person.maidenName) lines.push(`2 NPFX ${person.maidenName}`);
    if (person.gender === 'male') lines.push('1 SEX M');
    else if (person.gender === 'female') lines.push('1 SEX F');
    
    if (person.birthDate) {
      lines.push('1 BIRT');
      lines.push(`2 DATE ${formatGEDDate(person.birthDate)}`);
      if (person.birthPlace?.city) lines.push(`2 PLAC ${person.birthPlace.city}`);
    }
    if (person.deathDate) {
      lines.push('1 DEAT');
      lines.push(`2 DATE ${formatGEDDate(person.deathDate)}`);
      if (person.deathPlace?.city) lines.push(`2 PLAC ${person.deathPlace.city}`);
    }
    if (person.occupation) lines.push(`1 OCCU ${person.occupation}`);
  });

  lines.push('0 TRLR');
  return lines.join('\n');
}

function formatGEDDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function importGEDCOM(content: string): Partial<FamilyTree> {
  // Basic GEDCOM parser
  const persons: Person[] = [];
  const relationships: Relationship[] = [];
  const lines = content.split('\n');
  
  let currentPerson: Partial<Person> | null = null as Partial<Person> | null;
  let inBirt = false;
  let inDeat = false;
  
  lines.forEach(line => {
    const parts = line.trim().split(' ');
    const level = parseInt(parts[0]);
    const tag = parts[1];
    const value = parts.slice(2).join(' ');
    
    if (level === 0) {
      if (currentPerson?.id) persons.push(currentPerson as Person);
      currentPerson = null;
      inBirt = false;
      inDeat = false;
      
      if (tag?.startsWith('@') && parts[2] === 'INDI') {
        const id = tag.replace(/@/g, '');
        currentPerson = {
          id,
          firstName: '',
          lastName: '',
          gender: 'unknown',
          isAlive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    } else if (currentPerson) {
      if (tag === 'NAME') {
        const match = value.match(/^(.*?)\s*\/(.*?)\//);
        if (match) {
          currentPerson.firstName = match[1].trim();
          currentPerson.lastName = match[2].trim();
        }
      } else if (tag === 'SEX') {
        currentPerson.gender = value === 'M' ? 'male' : value === 'F' ? 'female' : 'unknown';
      } else if (tag === 'BIRT') {
        inBirt = true; inDeat = false;
      } else if (tag === 'DEAT') {
        inDeat = true; inBirt = false;
        currentPerson.isAlive = false;
      } else if (tag === 'DATE') {
        if (inBirt) currentPerson.birthDate = parseGEDDate(value);
        if (inDeat) currentPerson.deathDate = parseGEDDate(value);
      } else if (tag === 'PLAC') {
        if (inBirt) currentPerson.birthPlace = { city: value };
        if (inDeat) currentPerson.deathPlace = { city: value };
      } else if (tag === 'OCCU') {
        currentPerson.occupation = value;
      }
    }
  });
  
  if (currentPerson?.id) persons.push(currentPerson as Person);
  
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

export function describeRelation(fromId: string, toId: string, path: string[], relationships: Relationship[], persons: Person[]): string {
  if (path.length < 2) return 'Même personne';
  if (path.length === 2) {
    const parents = getParents(fromId, relationships, persons);
    const children = getChildren(fromId, relationships, persons);
    const spouses = getSpouses(fromId, relationships, persons);
    const siblings = getSiblings(fromId, relationships, persons);
    
    if (parents.some(p => p.id === toId)) return 'Parent';
    if (children.some(c => c.id === toId)) return 'Enfant';
    if (spouses.some(s => s.id === toId)) return 'Conjoint(e)';
    if (siblings.some(s => s.id === toId)) return 'Frère / Sœur';
  }
  if (path.length === 3) {
    const grandparents = getParents(path[1], relationships, persons);
    if (grandparents.some(p => p.id === toId)) return 'Grand-parent';
    const grandchildren = getChildren(path[1], relationships, persons);
    if (grandchildren.some(c => c.id === toId)) return 'Petit-enfant';
    return 'Cousin(e) / Oncle / Tante';
  }
  if (path.length === 4) return 'Arrière-grand-parent ou cousin(e) éloigné(e)';
  return `Lien familial (${path.length - 1} degrés)`;
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
