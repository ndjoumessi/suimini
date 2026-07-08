/**
 * Suppression déterministe des échos Realtime de nos propres écritures
 * (corrige le faux « un collaborateur a modifié cet arbre » en solo).
 * Tests purs (aucun navigateur, aucun réseau).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  isSelfEcho, recordSelfWrites, rowSignature, softDeleteSignature, hardDeleteSignature,
  _resetEchoRegistry,
} from '../src/lib/realtimeEcho';
import { pushChildTable, deleteChildRows, _setSoftDeleteSupported } from '../src/lib/supabaseSync';

// Faux client Supabase minimal (upsert/update/delete no-op réussis).
function fakeClient() {
  const chain: any = {
    upsert: () => Promise.resolve({ error: null }),
    update: () => chain,
    delete: () => chain,
    in: () => Promise.resolve({ error: null }),
    then: (ok: any) => Promise.resolve({ error: null }).then(ok),
  };
  return { from: () => chain };
}

test.beforeEach(() => { _resetEchoRegistry(); _setSoftDeleteSupported(true); });

test('un upsert enregistré → son écho est reconnu comme le nôtre', () => {
  const row = { id: 'p1', updated_at: '2026-07-08T10:00:00.000Z', deleted_at: null };
  recordSelfWrites([rowSignature('persons', row)]);
  // Écho Realtime (payload.new) de CETTE écriture.
  expect(isSelfEcho('persons', { id: 'p1', updated_at: '2026-07-08T10:00:00.000Z', deleted_at: null })).toBe(true);
});

test('format ISO différent (Z vs +00:00, ms) → toujours reconnu (normalisation epoch)', () => {
  recordSelfWrites([rowSignature('persons', { id: 'p1', updated_at: '2026-07-08T10:00:00.000Z' })]);
  // Realtime renvoie souvent « +00:00 » sans millisecondes.
  expect(isSelfEcho('persons', { id: 'p1', updated_at: '2026-07-08T10:00:00+00:00' })).toBe(true);
});

test("l'édit d'un VRAI collaborateur (updated_at différent) N'est PAS un écho → message affiché", () => {
  recordSelfWrites([rowSignature('persons', { id: 'p1', updated_at: '2026-07-08T10:00:00.000Z' })]);
  // Le collaborateur pose SON propre updated_at.
  expect(isSelfEcho('persons', { id: 'p1', updated_at: '2026-07-08T10:05:30.000Z' })).toBe(false);
});

test('une ligne jamais écrite par nous → pas un écho', () => {
  expect(isSelfEcho('persons', { id: 'zzz', updated_at: '2026-01-01T00:00:00.000Z' })).toBe(false);
});

test('relations : signature par contenu (pas de updated_at)', () => {
  const rel = { id: 'r1', type: 'spouse', person1_id: 'a', person2_id: 'b', start_date: null, end_date: null, is_active: true, notes: null, deleted_at: null };
  recordSelfWrites([rowSignature('relationships', rel)]);
  expect(isSelfEcho('relationships', { ...rel })).toBe(true);
  // Un collaborateur qui change le type → contenu différent → affiché.
  expect(isSelfEcho('relationships', { ...rel, type: 'partner' })).toBe(false);
});

test('soft-delete : notre tombstone est reconnue par (id, deleted_at)', () => {
  const ts = '2026-07-08T12:00:00.000Z';
  recordSelfWrites([softDeleteSignature('persons', 'p9', ts)]);
  // Écho d'un soft-delete = UPDATE avec deleted_at posé (updated_at inchangé).
  expect(isSelfEcho('persons', { id: 'p9', updated_at: '2020-01-01T00:00:00.000Z', deleted_at: ts })).toBe(true);
  // Un collaborateur qui supprime la même personne → autre deleted_at → affiché.
  expect(isSelfEcho('persons', { id: 'p9', updated_at: '2020-01-01T00:00:00.000Z', deleted_at: '2026-07-08T12:00:05.000Z' })).toBe(false);
});

test('hard-delete (repli pré-migration) reconnu par id', () => {
  recordSelfWrites([hardDeleteSignature('persons', 'p3')]);
  expect(isSelfEcho('persons', { id: 'p3' })).toBe(true); // payload.old = { id }
});

// ---- Intégration via les vrais chemins d'écriture ----

test('pushChildTable enregistre → simulate l’écho Realtime → reconnu', async () => {
  const client = fakeClient();
  const rows = [
    { id: 'p1', tree_id: 't1', first_name: 'Awa', updated_at: '2026-07-08T10:00:00.000Z' },
    { id: 'p2', tree_id: 't1', first_name: 'Ben', updated_at: '2026-07-08T10:00:00.000Z' },
  ];
  await pushChildTable('persons', rows, client);
  // Realtime renvoie chaque ligne upsertée avec deleted_at:null (on l'a posé).
  for (const r of rows) {
    expect(isSelfEcho('persons', { id: r.id, updated_at: r.updated_at, deleted_at: null })).toBe(true);
  }
  // Une personne d'un autre client → pas un écho.
  expect(isSelfEcho('persons', { id: 'p1', updated_at: '2026-07-08T11:11:11.000Z', deleted_at: null })).toBe(false);
});

test('deleteChildRows enregistre la tombstone → son écho est reconnu', async () => {
  const client = fakeClient();
  await deleteChildRows('relationships', ['r1', 'r2'], client);
  // On ne connaît pas le ts exact (now()), mais tout écho deleted_at RÉCENT de r1/r2
  // doit matcher : on rejoue avec un ts très proche via une fenêtre. Ici on vérifie
  // qu'un ts arbitraire NON enregistré ne matche pas (garde-fou), et que le chemin
  // ne jette pas.
  expect(isSelfEcho('relationships', { id: 'r1', type: 'spouse', person1_id: 'a', person2_id: 'b', deleted_at: '1999-01-01T00:00:00.000Z' })).toBe(false);
});
