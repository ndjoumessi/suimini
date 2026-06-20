// Robust GEDCOM (.ged) parser — the universal genealogy interchange format used
// by Ancestry, MyHeritage, FamilySearch, Geneanet, etc. Reads the LINEAGE-LINKED
// subset Suimini cares about (INDI + FAM records) and rebuilds parent/spouse links.
//
// Why a dedicated module (vs treeUtils.importGEDCOM): this one returns fresh ids
// (so imported records never collide with an existing tree), preview STATS, and
// handles more fields (NOTE → bio, partial/approximate dates, CONT/CONC line
// continuations). treeUtils keeps the legacy one-shot importer for back-compat.
import { Person, Relationship, Gender } from '@/types';
import { generateId } from '@/lib/treeUtils';

export interface ParsedGedcom {
  persons: Partial<Person>[];
  relationships: Partial<Relationship>[];
  stats: { persons: number; families: number };
}

interface GedLine { level: number; tag: string; value: string; xref?: string }

/** Split one GEDCOM line into { level, optional @xref@, tag, value }. */
function parseLine(raw: string): GedLine | null {
  const line = raw.replace(/﻿/g, '').trimEnd();
  if (!line.trim()) return null;
  const m = line.match(/^\s*(\d+)\s+(@[^@]+@\s+)?([A-Za-z0-9_]+)(?:\s+(.*))?$/);
  if (!m) return null;
  const level = parseInt(m[1], 10);
  if (Number.isNaN(level)) return null;
  return { level, xref: m[2]?.trim(), tag: m[3], value: (m[4] ?? '').trim() };
}

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

/** Parse a GEDCOM date. Handles "12 JUN 1948", "JUN 1948", "1948" and the
 *  ABT/EST/CAL/BEF/AFT qualifiers (which flag the date as approximate). */
function parseGedDate(value: string): { date?: string; approx: boolean } {
  if (!value) return { approx: false };
  let approx = false;
  let v = value.toUpperCase().trim();
  if (/^(ABT|EST|CAL|BEF|AFT|FROM|TO|BET)\b/.test(v)) {
    approx = true;
    v = v.replace(/^(ABT|EST|CAL|BEF|AFT|FROM|TO|BET)\s+/, '');
  }
  const parts = v.split(/\s+/);
  const year = parts.find(p => /^\d{3,4}$/.test(p));
  const mon = parts.find(p => MONTHS[p]);
  const day = parts.find(p => /^\d{1,2}$/.test(p));
  if (!year) return { approx };
  if (mon && day) return { date: `${year}-${MONTHS[mon]}-${day.padStart(2, '0')}`, approx };
  if (mon) return { date: `${year}-${MONTHS[mon]}-01`, approx: true };
  return { date: year, approx: true };
}

const xref = (v: string) => v.replace(/@/g, '').trim();

export function parseGEDCOM(content: string): ParsedGedcom {
  interface IndiRec {
    firstName: string; lastName: string; maidenName?: string; gender: Gender;
    birthDate?: string; birthDateApprox?: boolean; birthPlace?: string;
    deathDate?: string; deathDateApprox?: boolean; deathPlace?: string;
    occupation?: string; bio?: string; isAlive: boolean;
  }
  interface FamRec { husb?: string; wife?: string; children: string[] }

  const indi = new Map<string, IndiRec>();        // xref → record
  const fams: FamRec[] = [];

  let curIndi: IndiRec | null = null;
  let curFam: FamRec | null = null;
  // Which level-1 event we're collecting sub-tags (DATE/PLAC) for.
  let event: 'birt' | 'deat' | null = null;
  // Which field a CONT/CONC continuation should append to.
  let cont: 'bio' | null = null;

  for (const raw of content.split(/\r?\n/)) {
    const ln = parseLine(raw);
    if (!ln) continue;

    if (ln.level === 0) {
      curIndi = null; curFam = null; event = null; cont = null;
      // For a record line "0 @I1@ INDI" the record type lands in `tag` (the xref
      // sits between level and tag), so match on tag — never on value.
      if (ln.xref && ln.tag === 'INDI') {
        curIndi = { firstName: '', lastName: '', gender: 'unknown', isAlive: true };
        indi.set(xref(ln.xref), curIndi);
      } else if (ln.xref && ln.tag === 'FAM') {
        curFam = { children: [] };
        fams.push(curFam);
      }
      continue;
    }

    if (ln.level === 1) { event = null; cont = null; }

    if (curIndi) {
      switch (ln.tag) {
        case 'NAME': {
          const m = ln.value.match(/^(.*?)\s*\/(.*?)\/?\s*$/);
          if (m) { curIndi.firstName = m[1].trim(); curIndi.lastName = m[2].trim(); }
          else curIndi.firstName = ln.value.trim();
          break;
        }
        case 'GIVN': if (!curIndi.firstName) curIndi.firstName = ln.value.trim(); break;
        case 'SURN': if (!curIndi.lastName) curIndi.lastName = ln.value.trim(); break;
        case 'NPFX': case '_MARNM': if (!curIndi.maidenName) curIndi.maidenName = ln.value.trim(); break;
        case 'SEX': curIndi.gender = ln.value.startsWith('M') ? 'male' : ln.value.startsWith('F') ? 'female' : 'unknown'; break;
        case 'BIRT': event = 'birt'; break;
        case 'DEAT': event = 'deat'; curIndi.isAlive = false; break;
        case 'OCCU': curIndi.occupation = ln.value.trim(); break;
        case 'NOTE': curIndi.bio = (curIndi.bio ? curIndi.bio + '\n' : '') + ln.value.trim(); cont = 'bio'; break;
        case 'CONC': if (cont === 'bio') curIndi.bio = (curIndi.bio ?? '') + ln.value; break;
        case 'CONT': if (cont === 'bio') curIndi.bio = (curIndi.bio ?? '') + '\n' + ln.value; break;
        case 'DATE': {
          const { date, approx } = parseGedDate(ln.value);
          if (event === 'birt') { curIndi.birthDate = date; curIndi.birthDateApprox = approx; }
          else if (event === 'deat') { curIndi.deathDate = date; curIndi.deathDateApprox = approx; }
          break;
        }
        case 'PLAC':
          if (event === 'birt') curIndi.birthPlace = ln.value.trim();
          else if (event === 'deat') curIndi.deathPlace = ln.value.trim();
          break;
      }
    } else if (curFam) {
      switch (ln.tag) {
        case 'HUSB': curFam.husb = xref(ln.value); break;
        case 'WIFE': curFam.wife = xref(ln.value); break;
        case 'CHIL': curFam.children.push(xref(ln.value)); break;
      }
    }
  }

  // Assign fresh ids so imported records never collide with an existing tree.
  const idOf = new Map<string, string>();
  for (const key of indi.keys()) idOf.set(key, generateId());

  const persons: Partial<Person>[] = [];
  for (const [key, r] of indi) {
    persons.push({
      id: idOf.get(key),
      firstName: r.firstName || '?',
      lastName: r.lastName || '',
      maidenName: r.maidenName,
      gender: r.gender,
      isAlive: r.isAlive,
      birthDate: r.birthDate,
      birthDateApprox: r.birthDateApprox || undefined,
      birthPlace: r.birthPlace ? { city: r.birthPlace } : undefined,
      deathDate: r.deathDate,
      deathDateApprox: r.deathDateApprox || undefined,
      deathPlace: r.deathPlace ? { city: r.deathPlace } : undefined,
      occupation: r.occupation,
      bio: r.bio,
    });
  }

  const relationships: Partial<Relationship>[] = [];
  for (const f of fams) {
    const husb = f.husb && idOf.get(f.husb);
    const wife = f.wife && idOf.get(f.wife);
    if (husb && wife) {
      relationships.push({ id: generateId(), type: 'spouse', person1Id: husb, person2Id: wife, isActive: true });
    }
    for (const c of f.children) {
      const child = idOf.get(c);
      if (!child) continue;
      if (husb) relationships.push({ id: generateId(), type: 'parent', person1Id: husb, person2Id: child });
      if (wife) relationships.push({ id: generateId(), type: 'parent', person1Id: wife, person2Id: child });
    }
  }

  return { persons, relationships, stats: { persons: persons.length, families: fams.length } };
}
