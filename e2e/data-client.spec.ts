/**
 * Phase 0 — socle DataClient (PR1). Garde-fou pur (aucun navigateur) : la
 * frontière réseau unique existe, expose toute l'interface, et le flag est en
 * ROLLBACK par défaut ('direct'). Le comportement de sync lui-même reste couvert
 * par sync-logic / conflict-resolution / realtime-echo (fonctions supabaseSync
 * inchangées, toujours exportées et testées directement).
 */
import { test, expect } from '@playwright/test';
import { getDataClient, DATA_LAYER } from '../src/lib/dataClient';

const METHODS = ['loadTrees', 'loadOneTree', 'saveTree', 'deleteTree', 'deleteChildRows', 'detectDeleteConflicts', 'restoreEntity'] as const;

test('getDataClient() expose toute l’interface DataClient', () => {
  const c = getDataClient() as unknown as Record<string, unknown>;
  for (const m of METHODS) expect(typeof c[m]).toBe('function');
});

test('DATA_LAYER par défaut = direct (rollback par défaut, aucun flag posé)', () => {
  // En environnement de test NEXT_PUBLIC_DATA_LAYER n'est pas défini.
  expect(DATA_LAYER).toBe('direct');
});

test('getDataClient() est un singleton stable (même instance à chaque appel)', () => {
  expect(getDataClient()).toBe(getDataClient());
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
