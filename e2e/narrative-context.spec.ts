import { test, expect } from '@playwright/test';
import {
  buildGenerationMembers,
  buildBranchMembers,
  generationValues,
  erasForRange,
  eraContext,
  narrativeCacheKey,
  narrativeSignature,
} from '../src/lib/narrativeContext';
import { buildGenerationMap } from '../src/lib/treeUtils';
import type { FamilyTree, Person, Relationship } from '../src/types';

/**
 * Pure unit tests (no browser) for the focused-narrative context helpers:
 * generation members, branch descendants, Cameroonian era mapping, and the
 * cache signature used to invalidate localStorage when members change.
 *
 * Tree shape (parent → child):
 *   gp1 (m) ── gp2 (f)        gen 0
 *        │
 *     ┌──┴──┐
 *   pA(m)  aunt(f)            gen 1   (pA married to pB, an in-law)
 *   pA ── pB(f, in-law)
 *        │
 *     ┌──┴──┐
 *   c1(m)  c2(f)              gen 2
 */

const now = '2020-01-01T00:00:00.000Z';

function P(id: string, first: string, gender: Person['gender'], birthDate?: string, extra: Partial<Person> = {}): Person {
  return { id, firstName: first, lastName: 'Teda', gender, isAlive: true, birthDate, createdAt: now, updatedAt: now, ...extra };
}

function fixtureTree(): FamilyTree {
  const persons: Person[] = [
    P('gp1', 'Mathias', 'male', '1890-01-01'),
    P('gp2', 'Anne', 'female', '1895-01-01'),
    P('pA', 'Sebastien', 'male', '1925-01-01'),
    P('aunt', 'Claire', 'female', '1928-01-01'),
    P('pB', 'Rose', 'female', '1930-01-01'), // in-law spouse of pA
    P('c1', 'Paul', 'male', '1965-01-01'),
    P('c2', 'Julie', 'female', '1968-01-01'),
  ];
  const relationships: Relationship[] = [
    { id: 'sp0', type: 'spouse', person1Id: 'gp1', person2Id: 'gp2', isActive: true },
    { id: 'sp1', type: 'spouse', person1Id: 'pA', person2Id: 'pB', isActive: true },
    // gp1/gp2 → pA and aunt
    { id: 'r1', type: 'parent', person1Id: 'gp1', person2Id: 'pA' },
    { id: 'r2', type: 'parent', person1Id: 'gp2', person2Id: 'pA' },
    { id: 'r3', type: 'parent', person1Id: 'gp1', person2Id: 'aunt' },
    { id: 'r4', type: 'parent', person1Id: 'gp2', person2Id: 'aunt' },
    // pA/pB → c1 and c2
    { id: 'r5', type: 'parent', person1Id: 'pA', person2Id: 'c1' },
    { id: 'r6', type: 'parent', person1Id: 'pB', person2Id: 'c1' },
    { id: 'r7', type: 'parent', person1Id: 'pA', person2Id: 'c2' },
    { id: 'r8', type: 'parent', person1Id: 'pB', person2Id: 'c2' },
  ];
  return { id: 'teda1', name: 'Famille Teda', createdAt: now, updatedAt: now, persons, relationships, rootPersonId: 'gp1' };
}

test.describe('buildGenerationMembers', () => {
  test('members per generation are consistent with buildGenerationMap', () => {
    const tree = fixtureTree();
    const genMap = buildGenerationMap(tree);

    for (const g of generationValues(tree)) {
      const members = buildGenerationMembers(tree, g);
      // every member indeed maps to g
      for (const m of members) expect(genMap.get(m.id)).toBe(g);
      // and it captured ALL persons at that generation
      const expected = tree.persons.filter((p) => genMap.get(p.id) === g).length;
      expect(members.length).toBe(expected);
    }
  });

  test('generation 0 = grandparents, generation 2 = grandchildren', () => {
    const tree = fixtureTree();
    const gen0 = buildGenerationMembers(tree, 0).map((p) => p.id).sort();
    expect(gen0).toEqual(['gp1', 'gp2']);

    // spouse in-law pB sits at the same generation as pA (gen 1), grandchildren at gen 2
    const genMap = buildGenerationMap(tree);
    const childGen = genMap.get('c1')!;
    const grandkids = buildGenerationMembers(tree, childGen).map((p) => p.id).sort();
    expect(grandkids).toEqual(['c1', 'c2']);
  });

  test('sorted by birth year', () => {
    const tree = fixtureTree();
    const gen1 = buildGenerationMembers(tree, 1);
    const years = gen1.map((p) => p.birthDate);
    const sorted = [...years].sort();
    expect(years).toEqual(sorted);
  });

  test('empty generation → []', () => {
    const tree = fixtureTree();
    expect(buildGenerationMembers(tree, 99)).toEqual([]);
  });
});

test.describe('buildBranchMembers', () => {
  test('returns all descendants of the root, not ancestors or siblings', () => {
    const tree = fixtureTree();
    const branch = buildBranchMembers(tree, 'pA');
    expect(branch).not.toBeNull();
    const ids = branch!.descendants.map((p) => p.id).sort();
    expect(ids).toEqual(['c1', 'c2']);
    // members includes the root once
    expect(branch!.members.map((p) => p.id).sort()).toEqual(['c1', 'c2', 'pA']);
    // excludes ancestors (gp1/gp2), the spouse (pB) and the sibling (aunt)
    for (const excluded of ['gp1', 'gp2', 'pB', 'aunt']) {
      expect(ids).not.toContain(excluded);
    }
  });

  test('branch from a grandparent spans two generations', () => {
    const tree = fixtureTree();
    const branch = buildBranchMembers(tree, 'gp1')!;
    expect(branch.descendants.map((p) => p.id).sort()).toEqual(['aunt', 'c1', 'c2', 'pA']);
    expect(branch.maxDepth).toBe(2);
    expect(branch.textTree).toContain('Sebastien');
  });

  test('root with no descendants → members = [root], depth 0', () => {
    const tree = fixtureTree();
    const branch = buildBranchMembers(tree, 'c1')!;
    expect(branch.descendants).toEqual([]);
    expect(branch.members.map((p) => p.id)).toEqual(['c1']);
    expect(branch.maxDepth).toBe(0);
  });

  test('missing root → null', () => {
    const tree = fixtureTree();
    expect(buildBranchMembers(tree, 'nope')).toBeNull();
  });
});

test.describe('eraContext / erasForRange', () => {
  test('maps years to the right Cameroonian era', () => {
    expect(erasForRange(1890, 1895).map((e) => e.key)).toEqual(['precolonial']);
    expect(erasForRange(1930, 1940).map((e) => e.key)).toEqual(['colonial']);
    expect(erasForRange(1965, 1975).map((e) => e.key)).toEqual(['independence']);
    expect(erasForRange(1990, 2010).map((e) => e.key)).toEqual(['modern']);
  });

  test('a range spanning periods returns every overlapping era', () => {
    const keys = erasForRange(1910, 1965).map((e) => e.key);
    expect(keys).toEqual(['precolonial', 'colonial', 'independence']);
  });

  test('eraContext yields a localized non-empty string, empty when years unknown', () => {
    expect(eraContext(1890, 1895, 'fr')).toContain('allemand');
    expect(eraContext(1890, 1895, 'en')).toContain('German');
    expect(eraContext(NaN, NaN)).toBe('');
  });
});

test.describe('cache key + signature', () => {
  test('narrativeCacheKey encodes mode + target', () => {
    expect(narrativeCacheKey('full')).toBe('full');
    expect(narrativeCacheKey('generation', 2)).toBe('generation_2');
    expect(narrativeCacheKey('branch', undefined, 'pA')).toBe('branch_pA');
  });

  test('narrativeSignature changes when a member updatedAt changes', () => {
    const tree = fixtureTree();
    const members = buildGenerationMembers(tree, 1);
    const sig1 = narrativeSignature(members);

    // Touch one member → newer updatedAt → different signature (cache invalidation).
    const touched = members.map((p) => (p.id === 'pA' ? { ...p, updatedAt: '2021-06-01T00:00:00.000Z' } : p));
    const sig2 = narrativeSignature(touched);
    expect(sig2).not.toBe(sig1);

    // Same members, same timestamps → stable signature.
    expect(narrativeSignature(buildGenerationMembers(tree, 1))).toBe(sig1);
  });

  test('narrativeSignature changes when a member is added or removed', () => {
    const tree = fixtureTree();
    const members = buildGenerationMembers(tree, 1);
    const sig = narrativeSignature(members);
    expect(narrativeSignature(members.slice(1))).not.toBe(sig);
  });
});
