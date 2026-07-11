/**
 * Phase 0/1 — helpers partagés des endpoints /api/data/* (lecture + écriture).
 * Centralise AuthN + AuthZ + résolution du BACKEND (DataStore) pour éviter la
 * duplication. L'AuthZ tourne TOUJOURS via `store.authz` → le MÊME backend que
 * les données (sinon, données sur Railway mais owner-check sur Supabase = 403 à tort).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { canWriteTreeContent, isTreeOwner, canReadTreeAsMember, type Caller } from '@/lib/authz';
import { getDataStore, type DataStore } from '@/lib/dataStore';
import type { ChildTable } from '@/lib/supabaseSync';

export const CHILD_TABLES: ChildTable[] = ['persons', 'relationships', 'journal_entries'];
export function isChildTable(v: unknown): v is ChildTable {
  return typeof v === 'string' && (CHILD_TABLES as string[]).includes(v);
}

type Guard =
  | { ok: false; res: NextResponse }
  | { ok: true; client: any; caller: Caller; store: DataStore };

/** AuthN + résolution du store, sans contrôle d'accès (le caller doit exister). */
async function authed(): Promise<Guard> {
  const { client, caller } = await getServerAuth();
  if (!client) return { ok: false, res: NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 }) };
  if (!caller) return { ok: false, res: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }) };
  const store = await getDataStore(client, caller);
  return { ok: true, client, caller, store };
}

/** AuthN + AuthZ écriture/propriété sur un arbre. */
export async function guardTreeWrite(treeId: string, mode: 'write' | 'owner'): Promise<Guard> {
  const g = await authed();
  if (!g.ok) return g;
  const allowed = mode === 'owner'
    ? await isTreeOwner(g.store.authz, treeId, g.caller)
    : await canWriteTreeContent(g.store.authz, treeId, g.caller);
  if (!allowed) return { ok: false, res: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  return g;
}

/** AuthN + AuthZ lecture non masquée (owner | tree_shares | membre accepté). */
export async function guardTreeRead(treeId: string): Promise<Guard> {
  const g = await authed();
  if (!g.ok) return g;
  if (!(await canReadTreeAsMember(g.store.authz, treeId, g.caller))) {
    return { ok: false, res: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  }
  return g;
}
