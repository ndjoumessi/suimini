import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { FamilyTree, Person, Relationship, JournalEntry } from '@/types';

export interface SharedMeta { sharedByName?: string; permission?: string; }
export interface LoadResult { trees: FamilyTree[]; shared: Record<string, SharedMeta>; }

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------- Row mappers (keep every field → no data loss) ----------

function personToRow(p: Person, treeId: string): any {
  const {
    id, firstName, lastName, gender, birthDate, birthPlace, deathDate, deathPlace,
    isAlive, occupation, bio, profilePhoto, dnaOrigins, citations, customFields,
    tags, privacy, createdAt, updatedAt, ...rest
  } = p;
  return {
    id, tree_id: treeId, first_name: firstName, last_name: lastName, gender: gender ?? null,
    birth_date: birthDate ?? null, birth_place: birthPlace ?? null,
    death_date: deathDate ?? null, death_place: deathPlace ?? null,
    is_alive: isAlive ?? true, occupation: occupation ?? null, bio: bio ?? null,
    profile_photo: profilePhoto ?? null, dna_origins: dnaOrigins ?? null,
    citations: citations ?? null, custom_fields: customFields ?? null,
    tags: tags ?? null, privacy: privacy ?? null,
    extra: Object.keys(rest).length ? rest : null,
    created_at: createdAt, updated_at: updatedAt,
  };
}

function rowToPerson(r: any): Person {
  return {
    id: r.id, firstName: r.first_name || '', lastName: r.last_name || '',
    gender: r.gender || 'unknown',
    birthDate: r.birth_date || undefined, birthPlace: r.birth_place || undefined,
    deathDate: r.death_date || undefined, deathPlace: r.death_place || undefined,
    isAlive: r.is_alive ?? true, occupation: r.occupation || undefined, bio: r.bio || undefined,
    profilePhoto: r.profile_photo || undefined, dnaOrigins: r.dna_origins || undefined,
    citations: r.citations || undefined, customFields: r.custom_fields || undefined,
    tags: r.tags || undefined, privacy: r.privacy || undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
    ...(r.extra || {}),
  };
}

function relToRow(r: Relationship, treeId: string): any {
  const { id, type, person1Id, person2Id, startDate, endDate, isActive, notes, ...rest } = r;
  return {
    id, tree_id: treeId, type, person1_id: person1Id, person2_id: person2Id,
    start_date: startDate ?? null, end_date: endDate ?? null,
    is_active: isActive ?? null, notes: notes ?? null,
    extra: Object.keys(rest).length ? rest : null,
  };
}

function rowToRel(r: any): Relationship {
  return {
    id: r.id, type: r.type, person1Id: r.person1_id, person2Id: r.person2_id,
    startDate: r.start_date || undefined, endDate: r.end_date || undefined,
    isActive: r.is_active ?? undefined, notes: r.notes || undefined,
    ...(r.extra || {}),
  };
}

function journalToRow(e: JournalEntry, treeId: string): any {
  return {
    id: e.id, tree_id: treeId, title: e.title, date: e.date || null, content: e.content || null,
    mentioned_person_ids: e.mentionedPersonIds ?? null, photos: e.photos ?? null,
    created_at: e.createdAt, updated_at: e.updatedAt,
  };
}

function rowToJournal(r: any): JournalEntry {
  return {
    id: r.id, title: r.title || '', date: r.date || '', content: r.content || '',
    mentionedPersonIds: r.mentioned_person_ids || undefined, photos: r.photos || undefined,
    createdAt: r.created_at, updatedAt: r.updated_at || r.created_at,
  };
}

// ---------- Loading ----------

export async function loadTreesFromSupabase(userId: string): Promise<LoadResult> {
  if (!supabase) return { trees: [], shared: {} };
  const { data: treeRows, error } = await supabase.from('trees').select('*');
  if (error || !treeRows) return { trees: [], shared: {} };

  const treeIds = treeRows.map(t => t.id);
  const shared: Record<string, SharedMeta> = {};

  // Bulk-load children for all accessible trees.
  const [persons, rels, journal] = await Promise.all([
    treeIds.length ? supabase.from('persons').select('*').in('tree_id', treeIds) : Promise.resolve({ data: [] as any[] }),
    treeIds.length ? supabase.from('relationships').select('*').in('tree_id', treeIds) : Promise.resolve({ data: [] as any[] }),
    treeIds.length ? supabase.from('journal_entries').select('*').in('tree_id', treeIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  // Owner display names for shared trees.
  const otherOwners = Array.from(new Set(treeRows.filter(t => t.owner_id !== userId).map(t => t.owner_id)));
  const ownerNames: Record<string, string> = {};
  if (otherOwners.length) {
    // Peer profiles are no longer directly selectable (RLS now restricts profiles
    // to self/admin); fetch only the safe display fields via the RPC. Falls back to
    // a direct select if the RPC isn't deployed yet (pre-migration).
    type PubProfile = { id: string; display_name?: string | null; email?: string | null };
    const rpc = await supabase.rpc('get_public_profiles', { ids: otherOwners });
    let profs: PubProfile[] = [];
    if (!rpc.error && rpc.data) {
      profs = rpc.data as PubProfile[];
    } else {
      const direct = await supabase.from('profiles').select('id, display_name, email').in('id', otherOwners);
      profs = (direct.data ?? []) as PubProfile[];
    }
    profs.forEach(p => { ownerNames[p.id] = p.display_name || p.email || 'un collaborateur'; });
  }

  const trees: FamilyTree[] = treeRows.map(t => {
    if (t.owner_id !== userId) shared[t.id] = { sharedByName: ownerNames[t.owner_id] || 'un collaborateur' };
    return {
      id: t.id, name: t.name, description: t.description || undefined,
      settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
      rootPersonId: t.settings?.rootPersonId,
      persons: (persons.data || []).filter((r: any) => r.tree_id === t.id).map(rowToPerson),
      relationships: (rels.data || []).filter((r: any) => r.tree_id === t.id).map(rowToRel),
      journal: (journal.data || []).filter((r: any) => r.tree_id === t.id).map(rowToJournal),
    };
  });

  return { trees, shared };
}

export async function loadOneTree(treeId: string): Promise<FamilyTree | null> {
  if (!supabase) return null;
  const { data: t } = await supabase.from('trees').select('*').eq('id', treeId).single();
  if (!t) return null;
  const [persons, rels, journal] = await Promise.all([
    supabase.from('persons').select('*').eq('tree_id', treeId),
    supabase.from('relationships').select('*').eq('tree_id', treeId),
    supabase.from('journal_entries').select('*').eq('tree_id', treeId),
  ]);
  return {
    id: t.id, name: t.name, description: t.description || undefined,
    settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
    rootPersonId: t.settings?.rootPersonId,
    persons: (persons.data || []).map(rowToPerson),
    relationships: (rels.data || []).map(rowToRel),
    journal: (journal.data || []).map(rowToJournal),
  };
}

// ---------- Saving (upsert all rows + delete removed) ----------

async function syncChildTable(table: string, treeId: string, rows: any[]) {
  if (!supabase) return;
  if (rows.length) await supabase.from(table).upsert(rows);
  // Remove rows that no longer exist locally.
  const { data: existing } = await supabase.from(table).select('id').eq('tree_id', treeId);
  const keep = new Set(rows.map(r => r.id));
  const remove = (existing || []).map((r: any) => r.id).filter((id: string) => !keep.has(id));
  if (remove.length) await supabase.from(table).delete().in('id', remove);
}

export async function saveTreeToSupabase(tree: FamilyTree, ownerId: string, isOwner = true): Promise<void> {
  if (!supabase) return;
  // For shared trees the recipient may only write children, never the owning `trees` row.
  if (isOwner) {
    await supabase.from('trees').upsert({
      id: tree.id, owner_id: ownerId, name: tree.name, description: tree.description ?? null,
      settings: { ...(tree.settings || {}), rootPersonId: tree.rootPersonId },
      created_at: tree.createdAt, updated_at: new Date().toISOString(),
    });
  }
  await syncChildTable('persons', tree.id, tree.persons.map(p => personToRow(p, tree.id)));
  await syncChildTable('relationships', tree.id, tree.relationships.map(r => relToRow(r, tree.id)));
  await syncChildTable('journal_entries', tree.id, (tree.journal || []).map(e => journalToRow(e, tree.id)));
}

export async function deleteTreeFromSupabase(treeId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('trees').delete().eq('id', treeId); // children cascade
}

// ---------- Sharing ----------

export async function shareTree(treeId: string, email: string, permission: 'read' | 'write'): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase non configuré.' };
  const { error } = await supabase.from('tree_shares').upsert(
    { tree_id: treeId, shared_with_email: email.trim().toLowerCase(), permission },
    { onConflict: 'tree_id,shared_with_email' }
  );
  return { error: error?.message };
}

export async function listShares(treeId: string): Promise<{ email: string; permission: string }[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('tree_shares').select('shared_with_email, permission').eq('tree_id', treeId);
  return (data || []).map((s: any) => ({ email: s.shared_with_email, permission: s.permission }));
}

export async function unshareTree(treeId: string, email: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('tree_shares').delete().eq('tree_id', treeId).eq('shared_with_email', email);
}

// ---------- Public read-only sharing (is_public + public_slug) ----------

/** Current public state of a tree (owner-only read via RLS). */
export async function getPublicShare(treeId: string): Promise<{ isPublic: boolean; slug: string | null }> {
  if (!supabase) return { isPublic: false, slug: null };
  const { data } = await supabase.from('trees').select('is_public, public_slug').eq('id', treeId).single();
  return { isPublic: !!data?.is_public, slug: (data?.public_slug as string | null) ?? null };
}

/**
 * Toggle public read-only access. When enabling, a slug must be supplied; we keep
 * it on disable so re-enabling reuses the same shareable link (avoids unique churn).
 */
export async function setTreePublic(treeId: string, isPublic: boolean, slug?: string | null): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase non configuré.' };
  const patch: Record<string, any> = { is_public: isPublic };
  if (isPublic && slug) patch.public_slug = slug;
  const { error } = await supabase.from('trees').update(patch).eq('id', treeId);
  return { error: error?.message };
}

/**
 * Server-safe anonymous load of a public tree by slug. Uses a fresh anon client
 * (no session) — RLS `*_public_read` policies expose the rows when is_public.
 * Returns null when not found / not public / Supabase unconfigured.
 */
export async function loadPublicTree(slug: string): Promise<FamilyTree | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  // Explicit column allowlist — never select('*') for anonymous reads (keeps
  // owner_id and internal flags off the wire).
  const { data: t } = await sb.from('trees')
    .select('id, name, description, settings, created_at, updated_at')
    .eq('public_slug', slug).eq('is_public', true).maybeSingle();
  if (!t) return null;
  const [persons, rels] = await Promise.all([
    sb.from('persons').select('*').eq('tree_id', t.id),
    sb.from('relationships').select('*').eq('tree_id', t.id),
  ]);
  // Defence in depth: even though RLS already hides private fiches, drop any
  // private person here and any relationship that touches one. The journal is
  // never exposed publicly.
  const allPersons = (persons.data || []).map(rowToPerson).filter(p => p.privacy !== 'private');
  const visibleIds = new Set(allPersons.map(p => p.id));
  const allRels = (rels.data || []).map(rowToRel)
    .filter(r => visibleIds.has(r.person1Id) && visibleIds.has(r.person2Id));
  return {
    id: t.id, name: t.name, description: t.description || undefined,
    settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
    rootPersonId: t.settings?.rootPersonId,
    persons: allPersons,
    relationships: allRels,
    journal: [],
  };
}
