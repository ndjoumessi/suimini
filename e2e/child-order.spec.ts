/**
 * Ordre d'affichage des enfants = ordre d'âge (birth_date croissant), TOUTES
 * MÈRES CONFONDUES. Régression : getChildren renvoyait les enfants dans l'ordre
 * des relations `parent` (donc groupés par mère). Test pur (aucun navigateur) —
 * reproduit l'entrée exacte du bug (relations mère 1 PUIS mère 2) et vérifie que
 * getChildren les ré-ordonne par birth_date. FocusTree/TreeView/PDF consomment
 * getChildren (ou le même comparateur) → couverts par ce point de vérité.
 */
import { test, expect } from '@playwright/test';
import { getChildren, compareByBirthDate } from '../src/lib/treeUtils';
import type { FamilyTree, Person, Relationship } from '../src/types';

function person(id: string, first: string, last: string, birthDate?: string): Person {
  return { id, firstName: first, lastName: last, gender: 'unknown', isAlive: true,
    birthDate, createdAt: '2020-01-01', updatedAt: '2020-01-01' };
}

// Les 12 enfants de DJOUMESSI Mathias (teda-p38), avec leurs dates réelles.
const CHILDREN: Array<[string, string, string, string]> = [
  ['teda-p61', 'TIOTSIA', 'Luc Mirabeau', '1984-01-01'],
  ['teda-p62', 'TSANA', 'Arnauld', '1986-01-01'],
  ['teda-p63', 'LEKOGUIA', 'Anne Marie', '1989-01-01'],
  ['teda-p64', 'TEKEUGUETSOP', 'Dorese', '1993-01-01'],
  ['teda-p65', 'TSAGUE', 'Martial', '1993-07-01'],
  ['teda-p66', 'FEUDJIO', 'Rebecca', '1997-01-01'],
  ['teda-p67', 'DJOUMESSI KENFACK', 'Vitaly', '2001-07-01'],
  ['teda-p68', 'SOKENG', 'Francis', '1988-01-01'],
  ['teda-p69', 'DJOUMESSI', 'Romel Nelson', '1989-07-01'],
  ['teda-p70', 'NANGMO', 'Merlin', '1992-01-01'],
  ['teda-p71', 'DONGMO', 'Jean Michel', '1996-01-01'],
  ['teda-p72', 'AZEKENG', 'Anderson', '2001-01-01'],
];

function buildTree(): FamilyTree {
  const persons: Person[] = [person('teda-p38', 'DJOUMESSI', 'Mathias', '1955-01-01')];
  const relationships: Relationship[] = [];
  // ⚠️ Insère les relations DANS L'ORDRE DU BUG : d'abord les enfants de la mère 1
  // (p61..p67), puis ceux de la mère 2 (p68..p72). Sans tri, getChildren les
  // rendrait exactement dans cet ordre (groupés par mère).
  const motherOrder = ['teda-p61','teda-p62','teda-p63','teda-p64','teda-p65','teda-p66','teda-p67',
                       'teda-p68','teda-p69','teda-p70','teda-p71','teda-p72'];
  for (const [id, first, last, bd] of CHILDREN) persons.push(person(id, first, last, bd));
  motherOrder.forEach((cid, i) => relationships.push(
    { id: `teda-r${97 + i}`, type: 'parent', person1Id: 'teda-p38', person2Id: cid }));
  return { id: 'teda1', name: 'TEDA', createdAt: '2020-01-01', updatedAt: '2020-01-01', persons, relationships };
}

test('getChildren trie les enfants par birth_date, toutes mères confondues', () => {
  const tree = buildTree();
  const kids = getChildren('teda-p38', tree.relationships, tree.persons);

  // Ordre d'âge attendu (cf. validation) — intercalé, PAS groupé par mère.
  const expectedOrder = [
    'teda-p61', // 1984-01-01
    'teda-p62', // 1986-01-01
    'teda-p68', // 1988-01-01
    'teda-p63', // 1989-01-01
    'teda-p69', // 1989-07-01
    'teda-p70', // 1992-01-01
    'teda-p64', // 1993-01-01
    'teda-p65', // 1993-07-01
    'teda-p71', // 1996-01-01
    'teda-p66', // 1997-01-01
    'teda-p72', // 2001-01-01
    'teda-p67', // 2001-07-01
  ];
  expect(kids.map(k => k.id)).toEqual(expectedOrder);
  // Les dates ressortent bien croissantes.
  expect(kids.map(k => k.birthDate)).toEqual([
    '1984-01-01','1986-01-01','1988-01-01','1989-01-01','1989-07-01','1992-01-01',
    '1993-01-01','1993-07-01','1996-01-01','1997-01-01','2001-01-01','2001-07-01',
  ]);
});

test('compareByBirthDate : enfant sans date passe en dernier', () => {
  const a = person('a', 'A', 'x', '1990-01-01');
  const b = person('b', 'B', 'x', undefined);
  const c = person('c', 'C', 'x', '1980-01-01');
  const sorted = [a, b, c].sort(compareByBirthDate);
  expect(sorted.map(p => p.id)).toEqual(['c', 'a', 'b']);
});
