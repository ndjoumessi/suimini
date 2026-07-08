/**
 * Phase 0 — helpers partagés des endpoints /api/data/* (écriture).
 * Centralise AuthN + AuthZ + validation pour éviter la duplication.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getServerAuth } from '@/lib/apiAuth';
import { createSupabaseAuthzProvider, canWriteTreeContent, isTreeOwner, type Caller } from '@/lib/authz';
import type { ChildTable } from '@/lib/supabaseSync';

export const CHILD_TABLES: ChildTable[] = ['persons', 'relationships', 'journal_entries'];
export function isChildTable(v: unknown): v is ChildTable {
  return typeof v === 'string' && (CHILD_TABLES as string[]).includes(v);
}

type Guard =
  | { ok: false; res: NextResponse }
  | { ok: true; client: any; caller: Caller };

/** AuthN + (optionnel) AuthZ écriture/propriété sur un arbre. */
export async function guardTreeWrite(treeId: string, mode: 'write' | 'owner'): Promise<Guard> {
  const { client, caller } = await getServerAuth();
  if (!client) return { ok: false, res: NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 }) };
  if (!caller) return { ok: false, res: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }) };
  const authz = createSupabaseAuthzProvider(client);
  const allowed = mode === 'owner'
    ? await isTreeOwner(authz, treeId, caller)
    : await canWriteTreeContent(authz, treeId, caller);
  if (!allowed) return { ok: false, res: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }) };
  return { ok: true, client, caller };
}
