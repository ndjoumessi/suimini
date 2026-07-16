import { test, expect } from '@playwright/test';
import { exportGEDCOM } from '../src/lib/treeUtils';
import { parseGEDCOM } from '../src/lib/export/gedcomParser';
import type { FamilyTree, Person, Relationship } from '../src/types';

/**
 * Pure unit tests (no browser) for the GEDCOM NICK round-trip: exportGEDCOM emits
 * `2 NICK`, parseGEDCOM must read it back into Person.nickName — closing the loop.
 */

const now = '2020-01-01T00:00:00.000Z';
const NICK = 'Wamba Tchoupa II';

function fixtureTree(): FamilyTree {
  const father: Person = {
    id: 'p-father', firstName: 'Jean', lastName: 'Dupont', nickName: NICK,
    gender: 'male', isAlive: false,
    birthDate: '1920-05-12', birthPlace: { city: 'Lyon' },
    createdAt: now, updatedAt: now,
  };
  const mother: Person = {
    id: 'p-mother', firstName: 'Marie', lastName: 'Martin',
    gender: 'female', isAlive: true, birthDate: '1925-08-20',
    createdAt: now, updatedAt: now,
  };
  const child: Person = {
    id: 'p-child', firstName: 'Paul', lastName: 'Dupont',
    gender: 'male', isAlive: true, birthDate: '1950-03-15',
    createdAt: now, updatedAt: now,
  };
  const relationships: Relationship[] = [
    { id: 'r1', type: 'spouse', person1Id: 'p-father', person2Id: 'p-mother', isActive: true },
    { id: 'r2', type: 'parent', person1Id: 'p-father', person2Id: 'p-child' },
    { id: 'r3', type: 'parent', person1Id: 'p-mother', person2Id: 'p-child' },
  ];
  return {
    id: 't1', name: 'Famille Test', createdAt: now, updatedAt: now,
    persons: [father, mother, child], relationships,
  };
}

test.describe('GEDCOM NICK round-trip', () => {
  test('exportGEDCOM → parseGEDCOM preserves nickName', () => {
    const ged = exportGEDCOM(fixtureTree());
    expect(ged).toContain(`2 NICK ${NICK}`);

    const parsed = parseGEDCOM(ged);

    // Sanity: counts survive (3 persons; spouse + 2 parent links = 3 relationships).
    expect(parsed.persons.length).toBe(3);
    expect(parsed.relationships.length).toBe(3);
    expect(parsed.stats.persons).toBe(3);

    const jean = parsed.persons.find(p => p.firstName === 'Jean');
    expect(jean).toBeTruthy();
    expect(jean!.nickName).toBe(NICK);

    // Persons without a nickname keep it undefined.
    const marie = parsed.persons.find(p => p.firstName === 'Marie');
    expect(marie!.nickName).toBeUndefined();
  });

  test('hand-written snippet with 2 NICK parses to nickName', () => {
    const ged = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Foo /Bar/',
      '2 GIVN Foo',
      '2 SURN Bar',
      '2 NICK Foo',
      '1 SEX M',
      '0 TRLR',
    ].join('\n');

    const parsed = parseGEDCOM(ged);
    expect(parsed.persons.length).toBe(1);
    expect(parsed.persons[0].nickName).toBe('Foo');
  });
});
