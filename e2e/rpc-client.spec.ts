/**
 * Phase 0 — PR5 : forward RPC. Teste le chemin API de callRpc (rpcViaApi) avec un
 * fetch mocké, et la forme de retour { data, error } compatible supabase-js.
 * (Le chemin 'direct' est le comportement actuel supabase.rpc, inchangé.)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { rpcViaApi } from '../src/lib/data/rpcClient';

function mockFetch(res: { ok: boolean; status: number; json: any }) {
  const calls: { url: string; body: any }[] = [];
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : undefined });
    return { ok: res.ok, status: res.status, json: async () => res.json } as any;
  }) as any;
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('rpcViaApi : POST /api/data/rpc/[name] { args } → { data, error }', async () => {
  const m = mockFetch({ ok: true, status: 200, json: { data: [{ id: 'u1' }], error: null } });
  try {
    const r = await rpcViaApi('list_all_users');
    expect(m.calls[0].url).toBe('/api/data/rpc/list_all_users');
    expect(m.calls[0].body).toEqual({ args: {} });
    expect(r.data).toEqual([{ id: 'u1' }]);
    expect(r.error).toBe(null);
  } finally { m.restore(); }
});

test('rpcViaApi : encode le nom + transmet les args', async () => {
  const m = mockFetch({ ok: true, status: 200, json: { data: null, error: null } });
  try {
    await rpcViaApi('approve_user', { target_user_id: 'x' });
    expect(m.calls[0].url).toBe('/api/data/rpc/approve_user');
    expect(m.calls[0].body).toEqual({ args: { target_user_id: 'x' } });
  } finally { m.restore(); }
});

test('rpcViaApi : erreur HTTP → { data:null, error:{message} }', async () => {
  const m = mockFetch({ ok: false, status: 403, json: { error: 'RPC non autorisée.' } });
  try {
    const r = await rpcViaApi('nope');
    expect(r.data).toBe(null);
    expect(r.error?.message).toBe('RPC non autorisée.');
  } finally { m.restore(); }
});
