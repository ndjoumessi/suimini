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
import { query } from '@/lib/railwayDb';

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

  test('collaboration + data-plane RPC (members / invitation)', async () => {
    const store = new RailwayStore();
    const cTreeId = 'itest-collab-' + Math.random().toString(36).slice(2, 8);
    const tree: any = {
      id: cTreeId, name: 'Collab Tree', createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z',
      persons: [{ id: 'cp1', firstName: 'A', lastName: 'B', gender: 'male', isAlive: true, createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z' }],
      relationships: [], journal: [],
    };
    try {
      await store.saveTree(tree, caller.userId, true);

      // Comments.
      const c = await store.addComment(cTreeId, 'cp1', 'Bonjour', { id: caller.userId, name: 'Canary' });
      expect(c?.content).toBe('Bonjour');
      const comments = await store.fetchComments(cTreeId, 'cp1');
      expect(comments.length).toBe(1);
      expect(comments[0].authorName).toBe('Canary');

      // Suggestions.
      const s = await store.addSuggestion({ treeId: cTreeId, personId: 'cp1', field: 'firstName', currentValue: 'A', suggestedValue: 'Alpha', author: { id: caller.userId, name: 'Canary' } });
      expect(s?.suggestedValue).toBe('Alpha');
      expect(await store.countPendingSuggestions(cTreeId)).toBe(1);
      expect(await store.getSuggestionTreeId(s!.id)).toBe(cTreeId);
      expect(await store.resolveSuggestion(s!.id, 'accepted')).toBe(true);
      expect(await store.countPendingSuggestions(cTreeId)).toBe(0);

      // RPC my_tree_role : owner → 'owner'.
      const roleRes = await store.rpc('my_tree_role', { p_tree_id: cTreeId }, caller);
      expect(roleRes.data).toBe('owner');

      // Seed a member + a pending invitation directly, then exercise the member RPCs.
      await query(
        `insert into tree_members (tree_id, user_id, email, role, status, token, expires_at)
         values ($1,$2,$3,'viewer','accepted',null, now()+interval '7 days'),
                ($1,null,$4,'viewer','pending','itok-'||$5, now()+interval '7 days')`,
        [cTreeId, '22222222-2222-2222-2222-222222222222', 'member@suimini.test', 'invitee@suimini.test', cTreeId],
      );
      const members = await store.rpc('get_tree_members', { p_tree_id: cTreeId }, caller);
      expect((members.data as any[]).length).toBe(2);

      // getMyMemberships (chemin prêt-mais-inactif) : le membre ACCEPTÉ (user_id 222…)
      // voit bien cTreeId ; un user sans appartenance → [].
      const mine = await store.getMyMemberships('22222222-2222-2222-2222-222222222222');
      expect(mine.some(m => m.treeId === cTreeId && m.status === 'accepted')).toBe(true);
      expect((await store.getMyMemberships('00000000-0000-0000-0000-000000000000')).length).toBe(0);

      const upd = await store.rpc('update_member_role', { p_tree_id: cTreeId, p_email: 'member@suimini.test', p_role: 'editor' }, caller);
      expect(upd.error).toBeNull();

      // get_invitation by token (inviter_name null on Railway by design).
      const inv = await store.rpc('get_invitation', { p_token: 'itok-' + cTreeId }, caller);
      expect((inv.data as any[])[0]?.tree_name).toBe('Collab Tree');
      expect((inv.data as any[])[0]?.invited_email).toBe('invitee@suimini.test');

      // accept_invitation stamps the caller.
      const acc = await store.rpc('accept_invitation', { p_token: 'itok-' + cTreeId }, caller);
      expect((acc.data as any[])[0]?.tree_id).toBe(cTreeId);
      expect((acc.data as any[])[0]?.tree_name).toBe('Collab Tree');

      const rem = await store.rpc('remove_member', { p_tree_id: cTreeId, p_email: 'member@suimini.test' }, caller);
      expect(rem.error).toBeNull();
      const after = await store.rpc('get_tree_members', { p_tree_id: cTreeId }, caller);
      expect((after.data as any[]).length).toBe(1);

      // inviteMember (migré derrière le DataStore) — email normalisé, token émis,
      // et le membre apparaît ensuite via get_tree_members (même backend Railway).
      const invited = await store.inviteMember(cTreeId, 'Invited-New@Suimini.test', 'editor', caller.userId);
      expect(invited?.member.email).toBe('invited-new@suimini.test');
      expect(invited?.member.role).toBe('editor');
      expect(invited?.member.status).toBe('pending');
      expect(invited?.token).toBeTruthy();
      const list2 = await store.rpc('get_tree_members', { p_tree_id: cTreeId }, caller);
      expect((list2.data as any[]).some(m => m.email === 'invited-new@suimini.test' && m.role === 'editor')).toBe(true);
    } finally {
      await store.deleteTree(cTreeId, caller.userId);
    }
  });
});
