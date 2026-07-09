/**
 * Phase 0 — PR5 : forward des RPC. Les appels `supabase.rpc(...)` du client
 * passent par `callRpc(...)` : direct (flag 'direct') ou via /api/data/rpc/[name]
 * (flag 'api'). Même forme de retour que supabase-js : { data, error }.
 *
 * Les RPC sont SECURITY DEFINER et portent leur propre AuthZ (rôle admin,
 * appartenance…) → l'endpoint ne fait que forwarder sous l'identité de l'appelant.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/lib/supabase';
import { getDataLayer } from '@/lib/dataClient';

export interface RpcResult<T = any> { data: T | null; error: { message: string } | null }

/** Chemin API (testable en isolation). */
export async function rpcViaApi<T = any>(name: string, args?: Record<string, unknown>): Promise<RpcResult<T>> {
  try {
    const res = await fetch(`/api/data/rpc/${encodeURIComponent(name)}`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ args: args ?? {} }),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) return { data: null, error: { message: json?.error || `API ${res.status}` } };
    return { data: (json.data as T) ?? null, error: json.error ?? null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : 'RPC échouée' } };
  }
}

async function rpcViaDirect<T = any>(name: string, args?: Record<string, unknown>): Promise<RpcResult<T>> {
  if (!supabase) return { data: null, error: { message: 'Supabase non configuré' } };
  const { data, error } = await supabase.rpc(name, args as any);
  return { data: (data as T) ?? null, error: error ? { message: error.message } : null };
}

export function callRpc<T = any>(name: string, args?: Record<string, unknown>): Promise<RpcResult<T>> {
  return getDataLayer() === 'api' ? rpcViaApi<T>(name, args) : rpcViaDirect<T>(name, args);
}
