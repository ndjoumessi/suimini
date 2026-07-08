/**
 * Tests unitaires de la couche de sync (aucun navigateur, aucun réseau réel).
 * Garantissent l'architecture UPSERT-only + soft-delete de src/lib/supabaseSync.ts :
 * un faux client Supabase enregistre chaque requête émise, et la propriété
 * centrale vérifiée est « le push n'émet JAMAIS de DELETE », quel que soit
 * l'état (vide, partiel, périmé) du cache local.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  pushChildTable, deleteChildRows, saveTreeToSupabase, loadOneTree,
  preserveRemoteExtra, _setSoftDeleteSupported,
} from '../src/lib/supabaseSync';
import { mergeTreeFavoringLocal, treeIdSets, removedIds } from '../src/lib/syncMerge';
import type { FamilyTree, Person, Relationship } from '../src/types';

// ---------- Faux client Supabase (enregistre chaque requête) ----------

interface RecordedQuery {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete';
  payload?: any;
  filters: [string, ...any[]][];
}

/** Builder chaînable minimal reproduisant l'API supabase-js utilisée par la sync.
 * `resolver` décide de la réponse ({ data, error }) requête par requête. */
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
      or: (expr: string) => { q.filters.push(['or', expr]); return chain; },
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

const MISSING_COLUMN = {
  code: 'PGRST204',
  message: "Could not find the 'deleted_at' column of 'persons' in the schema cache",
};

// ---------- Fabriques d'entités minimales ----------

const person = (id: string, firstName = id): Person => ({
  id, firstName, lastName: '', gender: 'unknown', isAlive: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
} as Person);

const rel = (id: string, p1: string, p2: string): Relationship =>
  ({ id, type: 'parent', person1Id: p1, person2Id: p2 } as Relationship);

const tree = (id: string, persons: Person[], relationships: Relationship[] = []): FamilyTree => ({
  id, name: `Arbre ${id}`, persons, relationships, journal: [],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
} as FamilyTree);

// Le repli pré-migration est un flag module-level : le réarmer entre les tests.
test.beforeEach(() => _setSoftDeleteSupported(true));

// ---------- pushChildTable : UPSERT-only ----------

test('push : n’émet jamais de DELETE ni de SELECT de diff', async () => {
  const { client, calls } = fakeClient();
  await pushChildTable('persons', [{ id: 'p1' }, { id: 'p2' }], client);
  expect(calls).toHaveLength(1);
  expect(calls[0].op).toBe('upsert');
  expect(calls.some(c => c.op === 'delete' || c.op === 'select')).toBe(false);
});

test('push : les lignes poussées sont vivantes (deleted_at: null → un undo ranime)', async () => {
  const { client, calls } = fakeClient();
  await pushChildTable('persons', [{ id: 'p1', first_name: 'Awa' }], client);
  expect(calls[0].payload).toEqual([{ id: 'p1', first_name: 'Awa', deleted_at: null }]);
});

test('push : un cache local VIDE ne déclenche AUCUNE requête (le scénario de l’incident TEDA)', async () => {
  const { client, calls } = fakeClient();
  await pushChildTable('persons', [], client);
  expect(calls).toHaveLength(0);
});

test('push : repli pré-migration — upsert re-tenté sans deleted_at sur PGRST204', async () => {
  let failedOnce = false;
  const { client, calls } = fakeClient(q => {
    if (q.op === 'upsert' && !failedOnce) { failedOnce = true; return { error: MISSING_COLUMN }; }
    return {};
  });
  await pushChildTable('persons', [{ id: 'p1' }], client);
  expect(calls).toHaveLength(2);
  expect(calls[0].payload[0]).toHaveProperty('deleted_at', null);
  expect(calls[1].payload[0]).not.toHaveProperty('deleted_at');
});

test('push : une vraie erreur d’écriture est REMONTÉE (jamais un « saved » mensonger)', async () => {
  const { client } = fakeClient(q =>
    q.op === 'upsert' ? { error: { code: '42501', message: 'permission denied' } } : {});
  await expect(pushChildTable('persons', [{ id: 'p1' }], client)).rejects.toMatchObject({ code: '42501' });
});

// ---------- saveTreeToSupabase : arbre entier ----------

test('save arbre : upserts uniquement — un cache PARTIEL ne peut rien purger', async () => {
  const { client, calls } = fakeClient(q =>
    q.table === 'trees' && q.op === 'select' ? { data: { id: 't1' } } : {});
  // 1 seule personne locale alors que le serveur en détient 57 : l'ancien
  // diff-DELETE aurait purgé les 56 autres. Ici : zéro DELETE, par construction.
  await saveTreeToSupabase(tree('t1', [person('p1')]), 'owner-1', true, client);
  expect(calls.some(c => c.op === 'delete')).toBe(false);
  const upserts = calls.filter(c => c.op === 'upsert');
  expect(upserts.map(c => c.table)).toEqual(['persons']);
});

test('save arbre : owner_id n’est jamais réécrit sur un arbre existant', async () => {
  const { client, calls } = fakeClient(q =>
    q.table === 'trees' && q.op === 'select' ? { data: { id: 't1' } } : {});
  await saveTreeToSupabase(tree('t1', [person('p1')]), 'owner-1', true, client);
  const update = calls.find(c => c.table === 'trees' && c.op === 'update');
  expect(update).toBeTruthy();
  expect(update!.payload).not.toHaveProperty('owner_id');
});

// ---------- deleteChildRows : soft-delete ----------

test('suppression : pose une tombstone (UPDATE deleted_at), jamais de DELETE', async () => {
  const { client, calls } = fakeClient();
  const ok = await deleteChildRows('persons', ['p1', 'p2'], client);
  expect(ok).toBe(true);
  expect(calls).toHaveLength(1);
  expect(calls[0].op).toBe('update');
  expect(calls[0].payload.deleted_at).toBeTruthy();
  expect(calls[0].filters).toEqual([['in', 'id', ['p1', 'p2']]]);
});

test('suppression : repli pré-migration — DELETE dur si la colonne n’existe pas', async () => {
  const { client, calls } = fakeClient(q =>
    q.op === 'update' ? { error: MISSING_COLUMN } : {});
  const ok = await deleteChildRows('persons', ['p1'], client);
  expect(ok).toBe(true);
  expect(calls.map(c => c.op)).toEqual(['update', 'delete']);
});

test('suppression : un échec réseau renvoie false (l’appelant garde le retrait en attente)', async () => {
  const { client, calls } = fakeClient(q =>
    q.op === 'update' ? { error: { code: '500', message: 'boom' } } : {});
  const ok = await deleteChildRows('persons', ['p1'], client);
  expect(ok).toBe(false);
  expect(calls.some(c => c.op === 'delete')).toBe(false); // surtout pas de repli dur
});

// ---------- Chargement : filtrage des tombstones ----------

test('chargement : les lignes tombstonées sont invisibles', async () => {
  const { client } = fakeClient(q => {
    if (q.table === 'trees') return { data: { id: 't1', name: 'T', created_at: 'c', updated_at: 'u' } };
    if (q.table === 'persons') return { data: [
      { id: 'p1', first_name: 'Vivante' },
      { id: 'p2', first_name: 'Supprimée', deleted_at: '2026-07-01T00:00:00Z' },
    ] };
    if (q.table === 'relationships') return { data: [
      { id: 'r1', type: 'spouse', person1_id: 'p1', person2_id: 'p1' },
      { id: 'r2', type: 'spouse', person1_id: 'p1', person2_id: 'p2', deleted_at: '2026-07-01T00:00:00Z' },
    ] };
    return { data: [] };
  });
  const t = await loadOneTree('t1', client);
  expect(t!.persons.map(p => p.id)).toEqual(['p1']);
  expect(t!.relationships.map(r => r.id)).toEqual(['r1']);
});

// ---------- removedIds : retraits implicites (diff « affiché puis retiré ») ----------

test('removedIds : sans état connu (cache jamais chargé), on ne supprime RIEN', () => {
  const current = treeIdSets(tree('t1', [person('p1')]));
  expect(removedIds(undefined, current)).toEqual({ persons: [], relationships: [], journal: [] });
});

test('removedIds : seuls les ids affichés PUIS retirés sont propagés', () => {
  const known = treeIdSets(tree('t1', [person('p1'), person('p2')], [rel('r1', 'p1', 'p2')]));
  const current = treeIdSets(tree('t1', [person('p1'), person('p3')])); // p2 retiré (undo d'un ajout), p3 ajouté, r1 retirée
  const gone = removedIds(known, current);
  expect(gone.persons).toEqual(['p2']);
  expect(gone.relationships).toEqual(['r1']);
  expect(gone.journal).toEqual([]);
});

// ---------- mergeTreeFavoringLocal : F5 dans la fenêtre de latence de commit ----------

test('merge : une suppression locale récente n’est jamais ressuscitée par le distant', () => {
  const local = tree('t1', [person('p1')]);
  const remote = tree('t1', [person('p1'), person('p2')]); // p2 pas encore tombstoné côté serveur
  const merged = mergeTreeFavoringLocal(local, remote, new Set(['p2']));
  expect(merged.persons.map(p => p.id)).toEqual(['p1']);
});

test('merge : l’édition locale (rename) prime sur une lecture distante périmée', () => {
  const local = tree('t1', [person('p1', 'Nouveau Nom')]);
  const remote = tree('t1', [person('p1', 'Ancien Nom')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set());
  expect(merged.persons[0].firstName).toBe('Nouveau Nom');
});

test('merge : l’ajout d’un collaborateur est conservé', () => {
  const local = tree('t1', [person('p1')]);
  const remote = tree('t1', [person('p1'), person('p2')], [rel('r1', 'p1', 'p2')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set());
  expect(merged.persons.map(p => p.id)).toEqual(['p1', 'p2']);
  expect(merged.relationships.map(r => r.id)).toEqual(['r1']);
});

test('merge : une relation distante vers une personne absente est écartée', () => {
  const local = tree('t1', [person('p1')]);
  const remote = tree('t1', [person('p1')], [rel('r1', 'p1', 'p-fantôme')]);
  const merged = mergeTreeFavoringLocal(local, remote, new Set());
  expect(merged.relationships).toEqual([]);
});

// ---------- preserveRemoteExtra : un push ne doit pas écraser un extra distant ----------
// (ex. nickName ajouté hors-app via le SQL Editor, ignoré du state local chargé avant).

test('preserveRemoteExtra : conserve un nickName distant absent du push local', async () => {
  const { client } = fakeClient(q =>
    q.table === 'persons' && q.op === 'select'
      ? { data: [{ id: 'p1', extra: { nickName: 'Jiedong de Kopte' } }] }
      : {});
  const rows: any[] = [{ id: 'p1', first_name: 'MESSE', extra: null }];
  await preserveRemoteExtra('persons', rows, client);
  expect(rows[0].extra).toEqual({ nickName: 'Jiedong de Kopte' });
});

test('preserveRemoteExtra : le local prime (édition + effacement) sur le distant', async () => {
  const { client } = fakeClient(q =>
    q.table === 'persons' && q.op === 'select'
      ? { data: [{ id: 'p1', extra: { nickName: 'Ancien', maidenName: 'X' } }] }
      : {});
  // Local a VIDÉ nickName (le formulaire envoie '') et n'a pas maidenName.
  const rows: any[] = [{ id: 'p1', extra: { nickName: '' } }];
  await preserveRemoteExtra('persons', rows, client);
  // nickName vidé ('') gagne (pas de résurrection) ; maidenName distant inconnu → préservé.
  expect(rows[0].extra).toEqual({ maidenName: 'X', nickName: '' });
});

test('preserveRemoteExtra : fail-open si le SELECT échoue (rows inchangées)', async () => {
  const { client } = fakeClient(q =>
    q.table === 'persons' && q.op === 'select' ? { error: { message: 'boom' } } : {});
  const rows: any[] = [{ id: 'p1', extra: { a: 1 } }];
  await preserveRemoteExtra('persons', rows, client);
  expect(rows[0].extra).toEqual({ a: 1 });
});

test('saveTreeToSupabase : l’upsert persons porte l’extra distant préservé', async () => {
  const { client, calls } = fakeClient(q => {
    if (q.table === 'trees' && q.op === 'select') return { data: null };            // → INSERT trees
    if (q.table === 'persons' && q.op === 'select') return { data: [{ id: 'p1', extra: { nickName: 'Surnom' } }] };
    return {};
  });
  await saveTreeToSupabase(tree('t1', [person('p1', 'MESSE')]), 'owner-1', true, client);
  const upsert = calls.find(c => c.table === 'persons' && c.op === 'upsert');
  expect(upsert).toBeTruthy();
  expect(upsert!.payload[0].extra).toEqual({ nickName: 'Surnom' }); // surnom non écrasé
});

// ---------- Round-trip nickName (Option B : mapping symétrique) ----------

test('round-trip : un nickName survit à save (extra) → load (person.nickName)', async () => {
  // 1) SAVE : capture la ligne persons upsertée pour une personne portant un nickName.
  const saver = fakeClient(q => (q.table === 'persons' && q.op === 'select' ? { data: [] } : q.table === 'trees' ? { data: null } : {}));
  const p = { ...person('p1', 'MESSE'), nickName: 'Jiedong de Kopte' } as Person;
  await saveTreeToSupabase(tree('t1', [p]), 'owner-1', true, saver.client);
  const savedRow = saver.calls.find(c => c.table === 'persons' && c.op === 'upsert')!.payload[0];
  expect(savedRow.extra).toEqual({ nickName: 'Jiedong de Kopte' }); // personToRow → extra

  // 2) LOAD : rejoue cette ligne → rowToPerson doit re-exposer person.nickName.
  const loader = fakeClient(q => {
    if (q.table === 'trees') return { data: { id: 't1', name: 'T', created_at: 'x', updated_at: 'y', settings: {} } };
    if (q.table === 'persons') return { data: [savedRow] };
    return { data: [] };
  });
  const loaded = await loadOneTree('t1', loader.client);
  expect(loaded!.persons[0].nickName).toBe('Jiedong de Kopte');
});
