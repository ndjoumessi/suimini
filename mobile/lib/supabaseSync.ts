/**
 * Data sync for mobile — routes tree CONTENT (trees/persons/relationships) through
 * the same /api/data/* HTTP boundary the web app uses, instead of talking to
 * Supabase directly. Filename kept for continuity with the web's own
 * `src/lib/supabaseSync.ts` (which the mobile mappers used to mirror line for
 * line) and with the single call site in `store.ts` — the underlying backend
 * has simply moved.
 *
 * WHY THIS CHANGED (2026-07-12): since 2026-07-11 the web's tree data plane is
 * on Railway Postgres (`DB_BACKEND=railway`, 100% rollout — see CLAUDE.md
 * "Backend données — Railway"). Every write from the web now lands on
 * Railway via `/api/data/trees/[id]/save`, not Supabase. This file used to
 * call `supabase.from('trees'|'persons'|'relationships'|'journal_entries')`
 * directly — so mobile kept reading Supabase's `persons`/`relationships`
 * tables, which stopped receiving new writes the moment the flip happened.
 * Symptom: edits made on the web (or by another device routed through the
 * API) never appeared on mobile, no matter how many times you pulled to
 * refresh — the mobile client was reading a source that had gone stale.
 * `/api/data/*` already supports mobile auth (`Authorization: Bearer
 * <access_token>`, see `src/lib/apiAuth.ts`), so this file now goes through
 * it instead — mobile and web share one backend again.
 *
 * Row↔app-shape mapping (personToRow/rowToPerson/etc.) is no longer needed
 * here: the API accepts and returns `Person`/`Relationship`/`FamilyTree`
 * objects already in app shape (camelCase) — the server-side DataStore does
 * the DB row mapping now.
 *
 * Identity (GoTrue session) is untouched and still talks to Supabase directly
 * via `./supabase` — only tree CONTENT moved behind the API boundary, mirroring
 * the "hors périmètre" list in CLAUDE.md (auth/profiles stay direct on web too).
 */
import { supabase } from './supabase';
import type { FamilyTree, Person, Relationship } from './types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://suimini.vercel.app';

export interface WriteResult { error?: string }

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { accept: 'application/json', ...(await authHeaders()) },
  });
  if (!res.ok) throw new Error(`API ${res.status} sur ${path}`);
  return res.json() as Promise<T>;
}

async function apiSend<T>(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(await authHeaders()),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status} sur ${path}`);
  return res.json() as Promise<T>;
}

/** Loads every tree the connected user can see (owner + shared), with persons/
 * relationships/journal already resolved server-side (RLS on Supabase or
 * explicit AuthZ on Railway, whichever backend `getDataStore` picks). */
export async function loadTreesFromSupabase(): Promise<FamilyTree[]> {
  if (!supabase) return [];
  const result = await apiGet<{ trees?: FamilyTree[] }>('/api/data/trees');
  return result.trees ?? [];
}

/**
 * Upsert-only tree save (mirrors the web's `pushTreeNow` → `saveTree`): only
 * the rows present in `patch` are written, nothing else is touched or
 * deleted. Tree-level metadata (name/description/settings/rootPersonId) is
 * always resent from the current local tree so the `trees` row write stays
 * idempotent instead of blanking fields this call didn't intend to change —
 * the server recomputes real ownership from the authenticated caller, the
 * `isOwner` flag in the body is not trusted (see apiAuth.ts / save/route.ts).
 */
async function saveTreeRemote(
  tree: FamilyTree,
  patch: { persons?: Person[]; relationships?: Relationship[] },
): Promise<WriteResult> {
  try {
    await apiSend(`/api/data/trees/${encodeURIComponent(tree.id)}/save`, 'POST', {
      tree: {
        id: tree.id,
        name: tree.name,
        description: tree.description,
        settings: tree.settings,
        rootPersonId: tree.rootPersonId,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
        persons: patch.persons ?? [],
        relationships: patch.relationships ?? [],
        journal: [],
      },
      isOwner: true,
    });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Échec de sauvegarde.' };
  }
}

/** Soft-delete specific rows in one child table (persons or relationships). */
async function deleteChildRowsRemote(
  treeId: string,
  table: 'persons' | 'relationships',
  ids: string[],
): Promise<WriteResult> {
  if (!ids.length) return {};
  try {
    await apiSend(`/api/data/trees/${encodeURIComponent(treeId)}/children/delete`, 'POST', { table, ids });
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Échec de suppression.' };
  }
}

/** Upsert a person (insert or update). `tree` supplies the tree-level fields
 * so the save doesn't blank them (see saveTreeRemote). */
export async function upsertPersonRemote(tree: FamilyTree, person: Person): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  return saveTreeRemote(tree, { persons: [person] });
}

/** Soft-delete a person and any relationship touching it. The caller must
 * pass the relationship ids to remove — this file no longer has direct table
 * access to compute an `.or(person1_id.eq…,person2_id.eq…)` filter itself. */
export async function deletePersonRemote(
  treeId: string,
  personId: string,
  affectedRelationshipIds: string[],
): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  if (affectedRelationshipIds.length) {
    const relResult = await deleteChildRowsRemote(treeId, 'relationships', affectedRelationshipIds);
    if (relResult.error) return relResult;
  }
  return deleteChildRowsRemote(treeId, 'persons', [personId]);
}

/** Upsert a relationship (insert or update). */
export async function upsertRelationshipRemote(tree: FamilyTree, rel: Relationship): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  return saveTreeRemote(tree, { relationships: [rel] });
}

/** Soft-delete a relationship. */
export async function deleteRelationshipRemote(treeId: string, relId: string): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  return deleteChildRowsRemote(treeId, 'relationships', [relId]);
}
