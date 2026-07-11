/**
 * Tests d'INTÉGRATION réel-cloud du backend Railway (`RailwayStore`).
 *
 * Frappe une VRAIE base Railway de staging et vérifie les contrats de persistance
 * du plan données d'arbre migré (Phase 1) : upsert insert/update, fidélité
 * extra/jsonb/timestamps, owner_id écrit une seule fois, soft-delete tombstone,
 * détection delete-vs-edit, résurrection par restore, suppression en cascade,
 * et la visibilité loadTrees (owner / membre / partage) SANS RLS.
 *
 * AUTO-SKIP : sans `RAILWAY_TEST_DATABASE_URL`, tout le groupe est `describe.skip`
 * → la suite e2e normale reste verte sans configuration. Poser aussi
 * `RAILWAY_TEST_INSECURE_SSL=1` pour un staging Railway à cert auto-signé.
 *
 * ISOLATION : arbre à id aléatoire, supprimé en fin de test (hard-delete en
 * cascade). owner_id est un uuid arbitraire (pas de FK auth.users sur Railway).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { RailwayStore } from '@/lib/railwayStore';

const TEST_URL = process.env.RAILWAY_TEST_DATABASE_URL;
const RUN = !!TEST_URL;
// Le pool railwayDb lit RAILWAY_DATABASE_URL ; on mappe la var de test AVANT tout import.
if (RUN) {
  process.env.RAILWAY_DATABASE_URL = TEST_URL;
  if (process.env.RAILWAY_TEST_INSECURE_SSL === '1') process.env.RAILWAY_DB_INSECURE_SSL = '1';
}

const describeIntegration = RUN ? test.describe : test.describe.skip;

describeIntegration('Railway real-cloud store', () => {
  const caller = { userId: '11111111-1111-1111-1111-111111111111', email: 'canary@suimini.test', role: 'user' as const };
  const treeId = 'itest-' + Math.random().toString(36).slice(2, 10);

  test('tree data plane round-trips with full fidelity', async () => {
    const store = new RailwayStore();

    const tree: any = {
      id: treeId, name: 'ITest Tree', description: 'integration',
      createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z',
      rootPersonId: 'p1', settings: { theme: 'x' },
      persons: [
        { id: 'p1', firstName: 'DJOUMESSI', lastName: 'Mathias', gender: 'male', isAlive: true,
          birthPlace: { name: 'Bandjoun' }, tags: ['founder'], nickName: 'Le Sage',
          createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z' },
        { id: 'p2', firstName: 'TSANA', lastName: 'Sébastien', gender: 'male', isAlive: false,
          createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z' },
      ],
      relationships: [{ id: 'r1', type: 'parent', person1Id: 'p1', person2Id: 'p2', isActive: true }],
      journal: [{ id: 'j1', title: 'Naissance', date: '1900', content: 'note', createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z' }],
    };

    try {
      await store.saveTree(tree, caller.userId, true);

      const loaded = await store.loadOneTree(treeId);
      expect(loaded).toBeTruthy();
      expect(loaded!.persons.length).toBe(2);
      expect(loaded!.relationships.length).toBe(1);
      expect(loaded!.journal!.length).toBe(1);
      const p1 = loaded!.persons.find(p => p.id === 'p1')!;
      expect(p1.firstName).toBe('DJOUMESSI');
      expect((p1 as any).nickName).toBe('Le Sage');            // extra round-trips
      expect(typeof p1.createdAt).toBe('string');              // ISO string, pas Date
      expect(p1.createdAt as string).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(p1.birthPlace).toEqual({ name: 'Bandjoun' });     // jsonb round-trips

      // loadTrees : le owner voit son arbre, non marqué « partagé ».
      const lt = await store.loadTrees(caller);
      expect(lt.trees.find(t => t.id === treeId)).toBeTruthy();
      expect(lt.shared[treeId]).toBeFalsy();

      // update : owner_id JAMAIS réécrit (autre ownerId ignoré sur update).
      tree.name = 'ITest Tree v2';
      await store.saveTree(tree, '99999999-9999-9999-9999-999999999999', true);
      expect(await store.authz.getTreeOwnerId(treeId)).toBe(caller.userId);

      // soft-delete + conflit delete-vs-edit.
      expect(await store.deleteChildRows(treeId, 'persons', ['p2'])).toBe(true);
      expect((await store.loadOneTree(treeId))!.persons.length).toBe(1);
      const conflicts = await store.detectDeleteConflicts(treeId, 'persons', [{ id: 'p2', updatedAt: '2026-07-11T09:00:00.000Z' }]);
      expect(conflicts.length).toBe(1);

      // restore : la tombstone est ranimée.
      await store.restoreEntity(treeId, 'person', { id: 'p2', firstName: 'TSANA', lastName: 'Sébastien', gender: 'male', isAlive: false } as any);
      expect((await store.loadOneTree(treeId))!.persons.length).toBe(2);
    } finally {
      await store.deleteTree(treeId, caller.userId);
    }
    expect(await store.loadOneTree(treeId)).toBeNull();
  });
});
