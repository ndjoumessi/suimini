/**
 * Tests unitaires de la résolution de conflits multi-appareils (delete-vs-edit).
 * Aucun navigateur, aucun réseau réel : un faux client Supabase (même patron que
 * e2e/sync-logic.spec.ts) enregistre chaque requête. On vérifie que :
 *   (a) un delete-vs-edit (tombstone distante POSTÉRIEURE à notre édition) est détecté,
 *       exclu de l'upsert (pas de résurrection) et enfilé ;
 *   (b) une tombstone distante ANTÉRIEURE à notre édition N'est PAS un conflit (push
 *       normal) ;
 *   (c) mergeTreeFavoringLocal applique un last-write-wins (distant plus récent gagne,
 *       local plus récent gagne) ;
 *   (d) une suppression locale récente n'est jamais ressuscitée.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  pushChildTable, detectDeleteConflicts, restoreEntityAlive, _setSoftDeleteSupported,
} from '../src/lib/data/supabaseSync';
import { mergeTreeFavoringLocal } from '../src/lib/sync/syncMerge';
import {
  addConflicts, getConflicts, removeConflict, clearConflicts, Conflict,
} from '../src/lib/sync/conflictQueue';
import type { FamilyTree, Person } from '../src/types';

// ---------- Faux client Supabase (enregistre chaque requête) ----------

interface RecordedQuery {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: any;
  filters: [string, ...any[]][];
}

function fakeClient(resolver: (q: RecordedQuery) => { data?: any; error?: any } | undefined = () => ({})) {
  const calls: RecordedQuery[] = [];
  const from = (table: string) => {
    const q: RecordedQuery = { table, op: 'select', filters: [] };
    const chain: any = {
      select: () => chain,
      upsert: (payload: any) => { q.op = 'upsert'; q.payload = payload; return chain; },
      insert: (payload: any) => { q.op = 'insert'; q.payload = payload; return chain; },
      update: (payload: any) => { q.op = 'update'; q.payload = payload; return chain; },
      delete: () => { q.op = 'delete'; return chain; },
      eq: (col: string, v: any) => { q.filters.push(['eq', col, v]); return chain; },
      in: (col: string, v: any) => { q.filters.push(['in', col, v]); return chain; },
      single: () => chain,
      maybeSingle: () => chain,
      then: (onOk: any, onKo: any) => {
        calls.push(q);
        return Promise.resolve({ data: null, error: null, ...(resolver(q) ?? {}) }).then(onOk, onKo);
      },
    };
    return chain;
  };
  return { client: { from }, calls };
}

// ---------- Fabriques ----------

const person = (id: string, updatedAt: string, firstName = id): Person => ({
  id, firstName, lastName: '', gender: 'unknown', isAlive: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt,
} as Person);

const tree = (id: string, persons: Person[]): FamilyTree => ({
  id, name: `Arbre ${id}`, persons, relationships: [], journal: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
} as FamilyTree);

test.beforeEach(() => {
  _setSoftDeleteSupported(true);
  clearConflicts();
});

// ---------- (a) delete-vs-edit : détecté, exclu, enfilé, pas ressuscité ----------

test('(a) delete-vs-edit : tombstone distante POSTÉRIEURE → détecté, exclu de l’upsert, enfilé', async () => {
  const p1 = person('p1', '2026-01-01T00:00:00Z', 'Awa');
  // Le distant a supprimé p1 le 1er juin, APRÈS notre édition (1er janvier).
  const { client, calls } = fakeClient(q =>
    q.table === 'persons' && q.op === 'select'
      ? { data: [{ id: 'p1', deleted_at: '2026-06-01T00:00:00Z' }] } : {});

  const conflicts = await detectDeleteConflicts('persons', [{ id: p1.id, updatedAt: p1.updatedAt }], client);
  expect(conflicts).toEqual([{ id: 'p1', remoteDeletedAt: '2026-06-01T00:00:00Z' }]);

  // Enfilage (comme le fait pushTreeNow) + exclusion de l'upsert.
  addConflicts(conflicts.map(c => ({
    id: c.id, entityType: 'person', treeId: 't1', local: p1, remoteDeletedAt: c.remoteDeletedAt, type: 'delete-vs-edit',
  } as Conflict)));
  expect(getConflicts().map(c => c.id)).toEqual(['p1']);

  const conflictIds = new Set(conflicts.map(c => c.id));
  const toPush = tree('t1', [p1]).persons.filter(p => !conflictIds.has(p.id));
  await pushChildTable('persons', toPush.map(p => ({ id: p.id })), client);
  // p1 exclu → aucun upsert ne le ressuscite.
  const upserts = calls.filter(c => c.op === 'upsert');
  expect(upserts.some(c => JSON.stringify(c.payload).includes('p1'))).toBe(false);
});

// ---------- (b) tombstone antérieure : pas un conflit, le push continue ----------

test('(b) notre édition est plus récente que la tombstone → PAS un conflit, upsert normal', async () => {
  const p1 = person('p1', '2026-06-01T00:00:00Z', 'Awa'); // édité APRÈS la suppression
  const { client, calls } = fakeClient(q =>
    q.table === 'persons' && q.op === 'select'
      ? { data: [{ id: 'p1', deleted_at: '2026-01-01T00:00:00Z' }] } : {});

  const conflicts = await detectDeleteConflicts('persons', [{ id: p1.id, updatedAt: p1.updatedAt }], client);
  expect(conflicts).toEqual([]);

  // Rien à exclure → push normal, p1 upserté vivant (deleted_at:null).
  await pushChildTable('persons', [{ id: p1.id, first_name: p1.firstName }], client);
  const upsert = calls.find(c => c.op === 'upsert');
  expect(upsert!.payload).toEqual([{ id: 'p1', first_name: 'Awa', deleted_at: null }]);
});

test('(b bis) aucune tombstone distante → aucun conflit', async () => {
  const { client } = fakeClient(q =>
    q.table === 'persons' && q.op === 'select' ? { data: [{ id: 'p1', deleted_at: null }] } : {});
  const conflicts = await detectDeleteConflicts('persons', [{ id: 'p1', updatedAt: '2026-01-01T00:00:00Z' }], client);
  expect(conflicts).toEqual([]);
});

test('(b ter) fail-open : une erreur de SELECT → aucun conflit (le push continue comme avant)', async () => {
  const { client } = fakeClient(q =>
    q.op === 'select' ? { error: { code: '500', message: 'boom' } } : {});
  const conflicts = await detectDeleteConflicts('persons', [{ id: 'p1', updatedAt: '2026-01-01T00:00:00Z' }], client);
  expect(conflicts).toEqual([]);
});

test('(b quater) relation sans updatedAt : toute tombstone distante est un conflit (jamais de résurrection silencieuse)', async () => {
  const { client } = fakeClient(q =>
    q.table === 'relationships' && q.op === 'select'
      ? { data: [{ id: 'r1', deleted_at: '2026-03-01T00:00:00Z' }] } : {});
  const conflicts = await detectDeleteConflicts('relationships', [{ id: 'r1' }], client);
  expect(conflicts).toEqual([{ id: 'r1', remoteDeletedAt: '2026-03-01T00:00:00Z' }]);
});

// ---------- restoreEntityAlive : ré-upsert vivant ----------

test('restore : ré-upserte l’entité vivante (deleted_at:null), écrasant la tombstone', async () => {
  const p1 = person('p1', '2026-01-01T00:00:00Z', 'Awa');
  const { client, calls } = fakeClient();
  await restoreEntityAlive('t1', 'person', p1, client);
  const upsert = calls.find(c => c.op === 'upsert');
  expect(upsert!.table).toBe('persons');
  expect(upsert!.payload[0]).toMatchObject({ id: 'p1', deleted_at: null });
});

// ---------- conflictQueue : add / remove / clear ----------

test('conflictQueue : add dédupliqué, remove, clear', () => {
  const c: Conflict = { id: 'p1', entityType: 'person', treeId: 't1', local: person('p1', 'u'), remoteDeletedAt: 'd', type: 'delete-vs-edit' };
  addConflicts([c]);
  addConflicts([c]); // même remoteDeletedAt → pas de doublon
  expect(getConflicts().map(x => x.id)).toEqual(['p1']);
  removeConflict('p1');
  expect(getConflicts()).toEqual([]);
});

// ---------- (c) mergeTreeFavoringLocal : last-write-wins ----------

test('(c) merge LWW : le distant plus récent gagne', () => {
  const local = tree('t1', [person('p1', '2026-01-01T00:00:00Z', 'Ancien')]);
  const remote = tree('t1', [person('p1', '2026-06-01T00:00:00Z', 'Nouveau distant')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set());
  expect(merged.persons[0].firstName).toBe('Nouveau distant');
});

test('(c) merge LWW : le local plus récent gagne', () => {
  const local = tree('t1', [person('p1', '2026-06-01T00:00:00Z', 'Nouveau local')]);
  const remote = tree('t1', [person('p1', '2026-01-01T00:00:00Z', 'Ancien distant')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set());
  expect(merged.persons[0].firstName).toBe('Nouveau local');
});

test('(c) merge LWW : à horodatage égal, on garde le local (intention FAVOR_LOCAL)', () => {
  const local = tree('t1', [person('p1', '2026-01-01T00:00:00Z', 'Local')]);
  const remote = tree('t1', [person('p1', '2026-01-01T00:00:00Z', 'Distant')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set());
  expect(merged.persons[0].firstName).toBe('Local');
});

// ---------- (d) une suppression locale récente n'est jamais ressuscitée ----------

test('(d) merge : un id récemment supprimé localement n’est jamais ressuscité par le distant', () => {
  const local = tree('t1', [person('p1', '2026-01-01T00:00:00Z')]);
  const remote = tree('t1', [person('p1', '2026-01-01T00:00:00Z'), person('p2', '2026-06-01T00:00:00Z')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set(['p2']));
  expect(merged.persons.map(p => p.id)).toEqual(['p1']);
});
