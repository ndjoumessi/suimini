/**
 * Phase 0 — socle DataClient (PR1). Garde-fou pur (aucun navigateur) : la
 * frontière réseau unique existe, expose toute l'interface, et le flag est en
 * ROLLBACK par défaut ('direct'). Le comportement de sync lui-même reste couvert
 * par sync-logic / conflict-resolution / realtime-echo (fonctions supabaseSync
 * inchangées, toujours exportées et testées directement).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { getDataClient, getDataLayer, setServerDataLayer } from '../src/lib/dataClient';

const METHODS = ['loadTrees', 'loadOneTree', 'saveTree', 'deleteTree', 'deleteChildRows', 'detectDeleteConflicts', 'restoreEntity'] as const;

test('getDataClient() expose toute l’interface DataClient', () => {
  const c = getDataClient() as unknown as Record<string, unknown>;
  for (const m of METHODS) expect(typeof c[m]).toBe('function');
});

test('getDataLayer() par défaut = direct (aucun cookie / SSR)', () => {
  expect(getDataLayer()).toBe('direct'); // typeof document === 'undefined' en test
});

test('getDataLayer() : cookie suimini_data_layer=api → api (runtime, par session)', () => {
  const orig = (globalThis as any).document;
  (globalThis as any).document = { cookie: 'foo=1; suimini_data_layer=api; bar=2' };
  try { expect(getDataLayer()).toBe('api'); } finally { (globalThis as any).document = orig; }
});

test('getDataLayer() : cookie à valeur inconnue → direct (défaut sûr)', () => {
  const orig = (globalThis as any).document;
  (globalThis as any).document = { cookie: 'suimini_data_layer=bogus' };
  try { expect(getDataLayer()).toBe('direct'); } finally { (globalThis as any).document = orig; }
});

test('getDataLayer() : sans cookie → suit le DÉFAUT SERVEUR runtime', () => {
  const orig = (globalThis as any).document;
  (globalThis as any).document = { cookie: '' };
  try {
    setServerDataLayer('api');
    expect(getDataLayer()).toBe('api');
    setServerDataLayer('direct');
    expect(getDataLayer()).toBe('direct');
  } finally { setServerDataLayer('direct'); (globalThis as any).document = orig; }
});

test('getDataLayer() : cookie=direct FORCE direct même si défaut serveur=api (rollback ciblé)', () => {
  const orig = (globalThis as any).document;
  (globalThis as any).document = { cookie: 'suimini_data_layer=direct' };
  try {
    setServerDataLayer('api');
    expect(getDataLayer()).toBe('direct'); // l'override cookie prime sur le défaut serveur
  } finally { setServerDataLayer('direct'); (globalThis as any).document = orig; }
});

test('getDataLayer() : cookie=api FORCE api même si défaut serveur=direct', () => {
  const orig = (globalThis as any).document;
  (globalThis as any).document = { cookie: 'suimini_data_layer=api' };
  try {
    setServerDataLayer('direct');
    expect(getDataLayer()).toBe('api');
  } finally { setServerDataLayer('direct'); (globalThis as any).document = orig; }
});

test('getDataClient() reflète le cookie au RUNTIME (bascule sans reload)', () => {
  const orig = (globalThis as any).document;
  try {
    (globalThis as any).document = { cookie: '' };
    const direct = getDataClient();
    (globalThis as any).document = { cookie: 'suimini_data_layer=api' };
    const api = getDataClient();
    expect(api).not.toBe(direct); // instance différente selon le cookie, lu à chaque appel
  } finally { (globalThis as any).document = orig; }
});

// ── ApiDataClient (PR3) : lecture via /api/data/* (fetch mocké) ──────────────
import { apiDataClient } from '../src/lib/dataClient';

test('ApiDataClient.loadTrees → GET /api/data/trees, renvoie le LoadResult', async () => {
  const calls: string[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: any) => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => ({ trees: [{ id: 't1' }], shared: {} }) } as any;
  }) as any;
  try {
    const res = await apiDataClient.loadTrees('user1');
    expect(calls[0]).toBe('/api/data/trees');
    expect(res.trees[0].id).toBe('t1');
  } finally { globalThis.fetch = orig; }
});

test('ApiDataClient.loadOneTree → GET /api/data/trees/[id] ; 404 → null', async () => {
  const orig = globalThis.fetch;
  // cas OK
  globalThis.fetch = (async (url: any) => {
    expect(String(url)).toBe('/api/data/trees/t%20A'); // encodeURIComponent
    return { ok: true, status: 200, json: async () => ({ id: 't A', name: 'X', persons: [], relationships: [] }) } as any;
  }) as any;
  try {
    const t = await apiDataClient.loadOneTree('t A');
    expect(t?.id).toBe('t A');
  } finally { globalThis.fetch = orig; }
  // cas 404
  const orig2 = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, status: 404, json: async () => ({}) }) as any) as any;
  try {
    expect(await apiDataClient.loadOneTree('missing')).toBe(null);
  } finally { globalThis.fetch = orig2; }
});

// ── ApiDataClient (PR4) : écriture via /api/data/* (fetch mocké) ─────────────
function mockFetch(handler: (url: string, init: any) => any) {
  const calls: { url: string; method: string; body: any }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    return handler(String(url), init);
  }) as any;
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('ApiDataClient.saveTree → POST /save { tree, isOwner } (isOwner du client, recalculé serveur)', async () => {
  const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  try {
    await apiDataClient.saveTree({ id: 't1', name: 'X', persons: [], relationships: [] } as any, 'owner1', true);
    expect(m.calls[0]).toMatchObject({ url: '/api/data/trees/t1/save', method: 'POST' });
    expect(m.calls[0].body.tree.id).toBe('t1');
  } finally { m.restore(); }
});

test('ApiDataClient.deleteTree → DELETE /api/data/trees/[id]', async () => {
  const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({}) }));
  try {
    await apiDataClient.deleteTree('t1');
    expect(m.calls[0]).toMatchObject({ url: '/api/data/trees/t1', method: 'DELETE' });
  } finally { m.restore(); }
});

test('ApiDataClient.deleteChildRows → POST /children/delete { table, ids } → ok', async () => {
  const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  try {
    const ok = await apiDataClient.deleteChildRows('t1', 'persons', ['a', 'b']);
    expect(ok).toBe(true);
    expect(m.calls[0]).toMatchObject({ url: '/api/data/trees/t1/children/delete', method: 'POST' });
    expect(m.calls[0].body).toEqual({ table: 'persons', ids: ['a', 'b'] });
  } finally { m.restore(); }
});

test('ApiDataClient.detectDeleteConflicts → POST /conflicts → tableau', async () => {
  const m = mockFetch(() => ({ ok: true, status: 200, json: async () => [{ id: 'p1', remoteDeletedAt: 'x' }] }));
  try {
    const res = await apiDataClient.detectDeleteConflicts('t1', 'persons', [{ id: 'p1' }]);
    expect(res).toEqual([{ id: 'p1', remoteDeletedAt: 'x' }]);
    expect(m.calls[0].url).toBe('/api/data/trees/t1/conflicts');
  } finally { m.restore(); }
});

test('ApiDataClient.restoreEntity → POST /restore { entityType, entity }', async () => {
  const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  try {
    await apiDataClient.restoreEntity('t1', 'person', { id: 'p1' } as any);
    expect(m.calls[0]).toMatchObject({ url: '/api/data/trees/t1/restore', method: 'POST' });
    expect(m.calls[0].body).toEqual({ entityType: 'person', entity: { id: 'p1' } });
  } finally { m.restore(); }
});
