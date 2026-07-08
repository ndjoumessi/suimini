import { test, expect } from '@playwright/test';
import { exportGEDCOM } from '../src/lib/treeUtils';
import { parseGEDCOM } from '../src/lib/gedcomParser';
import type { FamilyTree, Person, Relationship } from '../src/types';

/**
 * Pure unit tests for the GEDCOM 5.5.1 EXPORT (no browser). Builds a tiny tree
 * (couple + child) exercising the enhancements — NICK, multi-line + long NOTE,
 * CRLF, richer HEAD — then feeds the output back into parseGEDCOM to prove the
 * emitted GEDCOM is well-formed (round-trip counts survive).
 */

const now = '2020-01-01T00:00:00.000Z';

// A paragraph guaranteed longer than the 248-char CONC wrap threshold, with NO
// newlines (so any CONT in the exported NOTE is proof of the multi-line split,
// and any CONC is proof of the long-line wrap).
const LONG_PARAGRAPH =
  'Il a vécu une vie remarquable pleine de voyages, de rencontres et de découvertes ' +
  'à travers plusieurs continents, laissant derrière lui une famille nombreuse, des ' +
  'récits transmis de génération en génération et un héritage culturel que ses ' +
  'descendants continuent de célébrer chaque année lors des grandes réunions familiales.';

const BIO = `Première ligne de la biographie.\n${LONG_PARAGRAPH}`;

function fixtureTree(): FamilyTree {
  const father: Person = {
    id: 'p-father', firstName: 'Jean', lastName: 'Dupont', nickName: 'Jeannot',
    gender: 'male', isAlive: false,
    birthDate: '1920-05-12', birthPlace: { city: 'Lyon' },
    deathDate: '1990-11-03', deathPlace: { city: 'Paris' },
    occupation: 'Menuisier', bio: BIO,
    createdAt: now, updatedAt: now,
  };
  const mother: Person = {
    id: 'p-mother', firstName: 'Marie', lastName: 'Martin', maidenName: 'Bernard',
    gender: 'female', isAlive: true,
    birthDate: '1925-08-20', birthPlace: { city: 'Marseille' },
    createdAt: now, updatedAt: now,
  };
  const child: Person = {
    id: 'p-child', firstName: 'Paul', lastName: 'Dupont',
    gender: 'male', isAlive: true, birthDate: '1950-03-15',
    createdAt: now, updatedAt: now,
  };
  const relationships: Relationship[] = [
    { id: 'r1', type: 'spouse', person1Id: 'p-father', person2Id: 'p-mother', startDate: '1948-06-10', isActive: true },
    { id: 'r2', type: 'parent', person1Id: 'p-father', person2Id: 'p-child' },
    { id: 'r3', type: 'parent', person1Id: 'p-mother', person2Id: 'p-child' },
  ];
  return {
    id: 't1', name: 'Famille Test', createdAt: now, updatedAt: now,
    persons: [father, mother, child], relationships,
  };
}

test.describe('exportGEDCOM (5.5.1)', () => {
  test('valid HEAD / TRLR and richer header', () => {
    const ged = exportGEDCOM(fixtureTree());
    const lines = ged.split('\r\n');
    expect(lines[0]).toBe('0 HEAD');
    expect(lines[lines.length - 1]).toBe('0 TRLR');
    expect(ged).toContain('1 SOUR Suimini');
    expect(ged).toContain('2 NAME Suimini Family Memory');
    expect(ged).toContain('2 VERS 1.0');
    expect(ged).toContain('1 DEST ANY');
    expect(ged).toContain('2 VERS 5.5.1');
    expect(ged).toContain('2 FORM LINEAGE-LINKED');
    expect(ged).toContain('1 CHAR UTF-8');
    expect(ged).toContain('1 FILE Famille Test');
  });

  test('CRLF line endings throughout', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect(ged).toContain('\r\n');
    // No bare LF that is not preceded by CR.
    expect(/[^\r]\n/.test(ged)).toBe(false);
  });

  test('one INDI per person with NAME / GIVN / SURN', () => {
    const ged = exportGEDCOM(fixtureTree());
    const indiCount = (ged.match(/^0 @[^@]+@ INDI$/gm) || []).length;
    expect(indiCount).toBe(3);
    expect(ged).toContain('0 @p-father@ INDI');
    expect(ged).toContain('1 NAME Jean /Dupont/');
    expect(ged).toContain('2 GIVN Jean');
    expect(ged).toContain('2 SURN Dupont');
  });

  test('NICK emitted from nickName', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect(ged).toContain('2 NICK Jeannot');
    // Only the father has a nickname.
    expect((ged.match(/^2 NICK /gm) || []).length).toBe(1);
  });

  test('NPFX emitted from maidenName', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect(ged).toContain('2 NPFX Bernard');
  });

  test('SEX M / F', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect((ged.match(/^1 SEX M$/gm) || []).length).toBe(2); // father + child
    expect((ged.match(/^1 SEX F$/gm) || []).length).toBe(1); // mother
  });

  test('BIRT and DEAT with DATE + PLAC', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect(ged).toContain('1 BIRT');
    expect(ged).toContain('2 DATE 12 MAY 1920');
    expect(ged).toContain('2 PLAC Lyon');
    expect(ged).toContain('1 DEAT');
    expect(ged).toContain('2 DATE 3 NOV 1990');
    expect(ged).toContain('2 PLAC Paris');
  });

  test('NOTE with CONT for the multi-line bio and CONC for the long line', () => {
    const ged = exportGEDCOM(fixtureTree());
    const lines = ged.split('\r\n');
    // First logical line rides on the NOTE tag.
    expect(lines).toContain('1 NOTE Première ligne de la biographie.');
    // Second logical line begins a CONT.
    const contLine = lines.find(l => l.startsWith('2 CONT '));
    expect(contLine).toBeTruthy();
    expect(contLine!.slice('2 CONT '.length)).toBe(LONG_PARAGRAPH.slice(0, 248));
    // The long line overflows past 248 chars → at least one CONC continuation.
    const concLines = lines.filter(l => l.startsWith('2 CONC '));
    expect(concLines.length).toBeGreaterThanOrEqual(1);
    // No emitted value line exceeds the 248-char payload limit.
    for (const l of lines) {
      const m = l.match(/^\d+ (?:@[^@]+@ )?[A-Z0-9_]+ (.*)$/);
      if (m) expect(m[1].length).toBeLessThanOrEqual(248);
    }
  });

  test('FAM record with HUSB / WIFE / CHIL + MARR', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect((ged.match(/^0 @[^@]+@ FAM$/gm) || []).length).toBe(1);
    expect(ged).toContain('1 HUSB @p-father@');
    expect(ged).toContain('1 WIFE @p-mother@');
    expect(ged).toContain('1 CHIL @p-child@');
    expect(ged).toContain('1 MARR');
    expect(ged).toContain('2 DATE 10 JUN 1948');
    // Person ↔ family links.
    expect(ged).toContain('1 FAMS @F1@');
    expect(ged).toContain('1 FAMC @F1@');
  });

  test('single-line values are sanitized of embedded newlines', () => {
    const tree = fixtureTree();
    tree.persons[0].occupation = 'Menuisier\nébéniste';
    tree.persons[0].birthPlace = { city: 'Lyon\r\nFrance' };
    const ged = exportGEDCOM(tree);
    expect(ged).toContain('1 OCCU Menuisier ébéniste');
    expect(ged).toContain('2 PLAC Lyon France');
  });

  test('round-trip: exported GEDCOM re-parses with the same counts', () => {
    const tree = fixtureTree();
    const ged = exportGEDCOM(tree);
    const parsed = parseGEDCOM(ged);

    // 3 persons in, 3 persons out.
    expect(parsed.stats.persons).toBe(3);
    expect(parsed.persons.length).toBe(3);

    // 1 family in, 1 family out.
    expect(parsed.stats.families).toBe(1);

    // Relationships: 1 spouse + 2 parent links survive the round-trip.
    const spouses = parsed.relationships.filter(r => r.type === 'spouse');
    const parents = parsed.relationships.filter(r => r.type === 'parent');
    expect(spouses.length).toBe(1);
    expect(parents.length).toBe(2);

    // Field fidelity on the father (ids are regenerated on import, so match by name).
    const father = parsed.persons.find(p => p.firstName === 'Jean');
    expect(father).toBeTruthy();
    expect(father!.lastName).toBe('Dupont');
    expect(father!.gender).toBe('male');
    expect(father!.isAlive).toBe(false);
    expect(father!.birthDate).toBe('1920-05-12');
    expect(father!.birthPlace?.city).toBe('Lyon');
    expect(father!.deathDate).toBe('1990-11-03');
    expect(father!.deathPlace?.city).toBe('Paris');
    expect(father!.occupation).toBe('Menuisier');
    expect(father!.maidenName).toBeUndefined();

    // The multi-line bio's first line survives; the long paragraph is present.
    expect(father!.bio).toContain('Première ligne de la biographie.');
    expect(father!.bio!.split('\n').length).toBeGreaterThanOrEqual(2);

    // NICK round-trip is closed: gedcomParser reads `2 NICK` back into nickName
    // (cf. gedcomParser.ts + CLAUDE.md « GEDCOM round-trip NICK »), so the
    // surname/nickname survives the export → re-import cycle.
    expect(father!.nickName).toBe('Jeannot');
  });
});
