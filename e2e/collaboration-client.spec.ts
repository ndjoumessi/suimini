/**
 * Phase 0 — migration de collaboration.ts derrière /api/data/*.
 * Garde-fou pur (aucun navigateur) : vérifie que le sélecteur public branche par
 * cookie (getDataLayer) vers les bons endpoints en mode 'api', que author_id n'est
 * JAMAIS envoyé dans le corps (dérivé serveur), que tout DÉGRADE (jamais de throw)
 * sur !ok, et que les cœurs *Direct(client) mappent correctement les lignes.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  fetchComments, addComment, fetchPendingSuggestions, countPendingSuggestions,
  addSuggestion, resolveSuggestion,
  fetchCommentsDirect, addCommentDirect, resolveSuggestionDirect, countPendingSuggestionsDirect,
} from '../src/lib/data/collaboration';

function withCookie(cookie: string, fn: () => Promise<void> | void) {
  const orig = (globalThis as any).document;
  (globalThis as any).document = { cookie };
  return Promise.resolve(fn()).finally(() => { (globalThis as any).document = orig; });
}
function mockFetch(handler: (url: string, init: any) => any) {
  const calls: { url: string; method: string; body: any }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    return handler(String(url), init);
  }) as any;
  return { calls, restore: () => { globalThis.fetch = orig; } };
}
/** Faux client Supabase chaînable + thenable (résout `result` à n'importe quel await). */
function fakeClient(result: any) {
  const calls: { m: string; args: any[] }[] = [];
  const chain: any = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (res: any) => Promise.resolve(result).then(res);
      return (...args: any[]) => { calls.push({ m: String(prop), args }); return chain; };
    },
  });
  return { client: chain, calls };
}

// ── Mode 'api' : bons endpoints, author_id jamais dans le corps ──────────────
test("api: fetchComments → GET /collaboration/comments?treeId&personId", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ comments: [{ id: 'c1' }] }) }));
    try {
      const c = await fetchComments('teda1', 'p 1');
      expect(c[0].id).toBe('c1');
      expect(m.calls[0].url).toBe('/api/data/collaboration/comments?treeId=teda1&personId=p%201');
      expect(m.calls[0].method).toBe('GET');
    } finally { m.restore(); }
  }));

test("api: addComment → POST { authorName } sans author.id", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ comment: { id: 'c9' } }) }));
    try {
      const c = await addComment('teda1', 'p1', '  coucou  ', { id: 'SPOOF', name: 'Nel' });
      expect(c?.id).toBe('c9');
      expect(m.calls[0]).toMatchObject({ url: '/api/data/collaboration/comments', method: 'POST' });
      expect(m.calls[0].body).toEqual({ treeId: 'teda1', personId: 'p1', content: 'coucou', authorName: 'Nel' });
      expect(JSON.stringify(m.calls[0].body)).not.toContain('SPOOF'); // author.id jamais transmis
    } finally { m.restore(); }
  }));

test("api: fetchPendingSuggestions inclut personId seulement s'il est fourni", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ suggestions: [] }) }));
    try {
      await fetchPendingSuggestions('teda1');
      await fetchPendingSuggestions('teda1', 'p2');
      expect(m.calls[0].url).toBe('/api/data/collaboration/suggestions?treeId=teda1');
      expect(m.calls[1].url).toBe('/api/data/collaboration/suggestions?treeId=teda1&personId=p2');
    } finally { m.restore(); }
  }));

test("api: countPendingSuggestions → GET /suggestions/count", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ count: 3 }) }));
    try {
      expect(await countPendingSuggestions('teda1')).toBe(3);
      expect(m.calls[0].url).toBe('/api/data/collaboration/suggestions/count?treeId=teda1');
    } finally { m.restore(); }
  }));

test("api: addSuggestion → POST { authorName } sans author.id", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ suggestion: { id: 's1' } }) }));
    try {
      const s = await addSuggestion({ treeId: 't', personId: 'p', field: 'firstName', currentValue: 'A', suggestedValue: 'B', author: { id: 'SPOOF', name: 'Nel' } });
      expect(s?.id).toBe('s1');
      expect(m.calls[0].body).toEqual({ treeId: 't', personId: 'p', field: 'firstName', currentValue: 'A', suggestedValue: 'B', authorName: 'Nel' });
      expect(JSON.stringify(m.calls[0].body)).not.toContain('SPOOF');
    } finally { m.restore(); }
  }));

test("api: resolveSuggestion → POST /suggestions/resolve { id, status }", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    try {
      expect(await resolveSuggestion('s1', 'accepted')).toBe(true);
      expect(m.calls[0]).toMatchObject({ url: '/api/data/collaboration/suggestions/resolve', method: 'POST' });
      expect(m.calls[0].body).toEqual({ id: 's1', status: 'accepted' });
    } finally { m.restore(); }
  }));

// ── Fail-safe : !ok ne throw jamais, renvoie le repli ────────────────────────
test("api: !ok → dégradation ([]/null/0/false), jamais de throw", () =>
  withCookie('suimini_data_layer=api', async () => {
    const m = mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    try {
      expect(await fetchComments('t', 'p')).toEqual([]);
      expect(await addComment('t', 'p', 'x', { id: 'u', name: 'n' })).toBe(null);
      expect(await fetchPendingSuggestions('t')).toEqual([]);
      expect(await countPendingSuggestions('t')).toBe(0);
      expect(await resolveSuggestion('s', 'rejected')).toBe(false);
    } finally { m.restore(); }
  }));

// ── Cœurs Direct : mapping + injection du client ─────────────────────────────
test('direct: fetchCommentsDirect mappe snake_case → camelCase', async () => {
  const { client, calls } = fakeClient({ data: [{ id: 'c1', tree_id: 't', person_id: 'p', author_id: 'a', author_name: 'N', content: 'hi', created_at: '2026-01-01' }], error: null });
  const out = await fetchCommentsDirect('t', 'p', client);
  expect(out).toEqual([{ id: 'c1', treeId: 't', personId: 'p', authorId: 'a', authorName: 'N', content: 'hi', createdAt: '2026-01-01' }]);
  expect(calls.map(c => c.m)).toEqual(expect.arrayContaining(['from', 'select', 'eq', 'order']));
});

test('direct: addCommentDirect trim + insert (author.id fait foi)', async () => {
  const { client, calls } = fakeClient({ data: { id: 'c2', tree_id: 't', person_id: 'p', author_id: 'srv', author_name: 'N', content: 'yo', created_at: 'x' }, error: null });
  const out = await addCommentDirect('t', 'p', '  yo  ', { id: 'srv', name: 'N' }, client);
  expect(out?.authorId).toBe('srv');
  const insert = calls.find(c => c.m === 'insert');
  expect(insert?.args[0]).toMatchObject({ tree_id: 't', person_id: 'p', author_id: 'srv', content: 'yo' });
});

test('direct: resolveSuggestionDirect renvoie !error', async () => {
  const ok = await resolveSuggestionDirect('s1', 'accepted', fakeClient({ error: null }).client);
  expect(ok).toBe(true);
  const ko = await resolveSuggestionDirect('s1', 'accepted', fakeClient({ error: { message: 'x' } }).client);
  expect(ko).toBe(false);
});

test('direct: countPendingSuggestionsDirect renvoie count, 0 si erreur', async () => {
  expect(await countPendingSuggestionsDirect('t', fakeClient({ count: 5, error: null }).client)).toBe(5);
  expect(await countPendingSuggestionsDirect('t', fakeClient({ count: null, error: { message: 'x' } }).client)).toBe(0);
});

// ── Sécurité du défaut : sans cookie → 'direct' (aucun fetch réseau) ─────────
test("défaut sans cookie = direct (pas d'appel /api/data)", () =>
  withCookie('', async () => {
    const m = mockFetch(() => ({ ok: true, status: 200, json: async () => ({ comments: [] }) }));
    try {
      // En mode direct + supabase non configuré en test → [] via le cœur direct,
      // et AUCUN fetch vers /api/data.
      await fetchComments('t', 'p');
      expect(m.calls.length).toBe(0);
    } finally { m.restore(); }
  }));
