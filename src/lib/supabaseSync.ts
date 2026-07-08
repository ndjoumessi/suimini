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
  // `extra` (catch-all des champs non normalisés) est étalé EN PREMIER : les colonnes
  // canoniques ci-dessous priment donc TOUJOURS. Étalé en dernier, un `extra` pollué par
  // une clé canonique (ex. un `updatedAt` résiduel) écrasait la vraie valeur de la colonne
  // → tri "Dernières modifications" faussé (personne éditée qui disparaît après un reload).
  // Bonus : la prochaine sauvegarde nettoie l'`extra` (personToRow retire ces clés).
  return {
    ...(r.extra || {}),
    id: r.id, firstName: r.first_name || '', lastName: r.last_name || '',
    gender: r.gender || 'unknown',
    birthDate: r.birth_date || undefined, birthPlace: r.birth_place || undefined,
    deathDate: r.death_date || undefined, deathPlace: r.death_place || undefined,
    isAlive: r.is_alive ?? true, occupation: r.occupation || undefined, bio: r.bio || undefined,
    profilePhoto: r.profile_photo || undefined, dnaOrigins: r.dna_origins || undefined,
    citations: r.citations || undefined, customFields: r.custom_fields || undefined,
    tags: r.tags || undefined, privacy: r.privacy || undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
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
  // `extra` en premier → les colonnes canoniques priment toujours (cf. rowToPerson).
  return {
    ...(r.extra || {}),
    id: r.id, type: r.type, person1Id: r.person1_id, person2Id: r.person2_id,
    startDate: r.start_date || undefined, endDate: r.end_date || undefined,
    isActive: r.is_active ?? undefined, notes: r.notes || undefined,
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

/** Filtre les tombstones (soft-delete). Côté client, pour que le même SELECT *
 * fonctionne avant ET après la migration soft-delete (colonne absente → rien
 * n'est filtré, comportement historique). */
function liveRows(rows: any[] | null | undefined): any[] {
  return (rows || []).filter((r: any) => !r.deleted_at);
}

export async function loadTreesFromSupabase(userId: string): Promise<LoadResult> {
  if (!supabase) return { trees: [], shared: {} };
  const { data: treeRows, error } = await supabase.from('trees').select('*');
  if (error || !treeRows) return { trees: [], shared: {} };

  const treeIds = treeRows.map(t => t.id);
  const shared: Record<string, SharedMeta> = {};

  // Bulk-load children for all accessible trees. NOTE: `treeIds` only contains the
  // trees the caller can SEE (trees_select = owner_id = auth.uid()). A tree whose
  // owner_id ≠ the connected account is excluded HERE, so none of its persons are
  // fetched — that, not a row limit, is why a mis-owned tree shows ~0 of its people.
  const [persons, rels, journal] = await Promise.all([
    treeIds.length ? supabase.from('persons').select('*').in('tree_id', treeIds) : Promise.resolve({ data: [] as any[] }),
    treeIds.length ? supabase.from('relationships').select('*').in('tree_id', treeIds) : Promise.resolve({ data: [] as any[] }),
    treeIds.length ? supabase.from('journal_entries').select('*').in('tree_id', treeIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  // Surface child-load errors instead of silently returning partial data.
  if ((persons as any).error) console.error('[sync] load persons échoué:', (persons as any).error.message);
  if ((rels as any).error) console.error('[sync] load relationships échoué:', (rels as any).error.message);
  if ((journal as any).error) console.error('[sync] load journal échoué:', (journal as any).error.message);

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
      persons: liveRows(persons.data).filter((r: any) => r.tree_id === t.id).map(rowToPerson),
      relationships: liveRows(rels.data).filter((r: any) => r.tree_id === t.id).map(rowToRel),
      journal: liveRows(journal.data).filter((r: any) => r.tree_id === t.id).map(rowToJournal),
    };
  });

  return { trees, shared };
}

export async function loadOneTree(treeId: string, client: any = supabase): Promise<FamilyTree | null> {
  if (!client) return null;
  const { data: t } = await client.from('trees').select('*').eq('id', treeId).single();
  if (!t) return null;
  const [persons, rels, journal] = await Promise.all([
    client.from('persons').select('*').eq('tree_id', treeId),
    client.from('relationships').select('*').eq('tree_id', treeId),
    client.from('journal_entries').select('*').eq('tree_id', treeId),
  ]);
  return {
    id: t.id, name: t.name, description: t.description || undefined,
    settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
    rootPersonId: t.settings?.rootPersonId,
    persons: liveRows(persons.data).map(rowToPerson),
    relationships: liveRows(rels.data).map(rowToRel),
    journal: liveRows(journal.data).map(rowToJournal),
  };
}

// ---------- Saving (UPSERT-only + soft-delete tombstones) ----------
//
// ARCHITECTURE : plus AUCUN DELETE piloté par un diff « distant − cache local ».
// L'ancienne syncChildTable inférait les suppressions par ABSENCE (toute ligne
// distante absente du cache local était purgée) : un cache partiel — course
// RLS/token, chargement interrompu, storage vidé — était indistinguable d'une
// suppression volontaire et pouvait effacer l'arbre entier (incident TEDA, 57
// personnes). Les gardes « cache vide » et « <50 % » n'étaient que des heuristiques.
// Désormais :
//   • push        = UPSERT pur des lignes locales, avec deleted_at: null
//                   (présent localement = vivant → un undo de suppression ranime
//                   la tombstone). Un cache vide ne pousse rien — et ne supprime
//                   rien, par construction.
//   • suppression = UPDATE deleted_at = now() (tombstone), jamais de DELETE. Les
//                   lectures filtrent deleted_at côté client. Une sur-suppression
//                   est donc TOUJOURS récupérable (SET deleted_at = NULL).
//   • retraits implicites (undo d'un ajout, fusion…) : le store diffe contre les
//                   ids qu'il a réellement AFFICHÉS (voir useFamilyStore), jamais
//                   contre l'état distant.
// Migration : supabase/soft-delete.sql. Tant qu'elle n'est pas exécutée, PostgREST
// rejette toute mention de deleted_at (PGRST204/42703) → repli automatique et
// durable : upsert sans la colonne, suppression dure (comportement historique).

let softDeleteSupported = true;
/** Couture de test — réinitialise le repli pré-migration. */
export function _setSoftDeleteSupported(v: boolean): void { softDeleteSupported = v; }

function isMissingDeletedAt(error: any): boolean {
  return (error?.code === 'PGRST204' || error?.code === '42703')
    && String(error?.message ?? '').includes('deleted_at');
}

export type ChildTable = 'persons' | 'relationships' | 'journal_entries';

/**
 * Push UPSERT-only d'une table enfant. N'émet JAMAIS de DELETE ni de SELECT de
 * diff : un état local vide/partiel ne peut rien purger. `client` injectable
 * pour les tests (défaut : le singleton).
 */
export async function pushChildTable(table: ChildTable, rows: any[], client: any = supabase): Promise<void> {
  if (!client || rows.length === 0) return;
  // deleted_at: null — une ligne présente localement est vivante ; l'upsert ranime
  // une éventuelle tombstone (undo d'une suppression, restauration d'un import).
  const payload = softDeleteSupported ? rows.map(r => ({ ...r, deleted_at: null })) : rows;
  let { error } = await client.from(table).upsert(payload);
  if (error && softDeleteSupported && isMissingDeletedAt(error)) {
    softDeleteSupported = false; // migration soft-delete pas encore exécutée
    ({ error } = await client.from(table).upsert(rows));
  }
  // Toute erreur est REMONTÉE (jamais avalée) : le store passe syncStatus à
  // 'error' et propose Réessayer, au lieu d'un « saved » mensonger.
  if (error) {
    console.error(`[sync] upsert ${table} échoué (${rows.length} lignes):`, error.message, error.code ?? '', error.details ?? '');
    throw error;
  }
}

/**
 * Suppression immédiate de lignes enfants précises — SOFT DELETE : pose une
 * tombstone (deleted_at = now()), la ligne reste en base et les lectures la
 * filtrent. Appelée par le push du store (diff « ids affichés puis retirés »).
 * Retourne true si la suppression a été persistée ; false → l'appelant doit
 * retenter (le store garde le retrait en attente et le rejouera au prochain
 * push). Repli : DELETE dur tant que la migration soft-delete n'est pas passée.
 */
export async function deleteChildRows(table: ChildTable, ids: string[], client: any = supabase): Promise<boolean> {
  if (!client || ids.length === 0) return true;
  if (softDeleteSupported) {
    const { error } = await client.from(table).update({ deleted_at: new Date().toISOString() }).in('id', ids);
    if (!error) return true;
    if (!isMissingDeletedAt(error)) {
      console.error(`[sync] soft-delete ${table} échoué:`, error.message, error.code ?? '');
      return false;
    }
    softDeleteSupported = false; // colonne absente → repli DELETE dur
  }
  const { error } = await client.from(table).delete().in('id', ids);
  if (error) { console.error(`[sync] suppression ${table} échouée:`, error.message, error.code ?? ''); return false; }
  return true;
}

// ---------- Résolution de conflits multi-appareils (delete-vs-edit) ----------
//
// Un UPSERT pur (deleted_at:null) RESSUSCITE une entité qu'un AUTRE appareil a
// soft-deletée pendant qu'on l'éditait. Avant le push, on lit l'état distant et on
// détecte ce cas ; l'appelant exclut alors l'entité de l'upsert et l'enfile pour
// résolution (voir conflictQueue + ConflictModal). TOUT est best-effort / fail-open :
// la moindre erreur de SELECT → aucun conflit détecté → le push se déroule EXACTEMENT
// comme avant (jamais de blocage de la sync).

export interface DeleteConflict {
  id: string;
  /** deleted_at distant (ISO) — l'entité a été tombstonée ailleurs. */
  remoteDeletedAt: string;
}

/**
 * Détection delete-vs-edit (best-effort, fail-open) : UNE seule requête
 * `select id, deleted_at .in('id', ids)` pour les entités poussées. Une entité est
 * en conflit quand la ligne distante porte une tombstone POSTÉRIEURE à notre dernière
 * édition locale (`remote.deleted_at > local.updatedAt`). Une entité sans `updatedAt`
 * local (ex. une relation, qui n'a pas de colonne dédiée) est signalée dès qu'une
 * tombstone distante existe : faute de pouvoir prouver que notre édition est plus
 * récente, on refuse de la ressusciter silencieusement.
 * `updated_at` distant n'est volontairement PAS lu : la table `relationships` n'a pas
 * cette colonne, et la comparaison se fait contre l'`updatedAt` LOCAL.
 * Retourne [] sur toute erreur / client absent / migration soft-delete non passée.
 */
export async function detectDeleteConflicts(
  table: ChildTable,
  entities: { id: string; updatedAt?: string }[],
  client: any = supabase,
): Promise<DeleteConflict[]> {
  if (!client || entities.length === 0 || !softDeleteSupported) return [];
  const ids = entities.map(e => e.id);
  let rows: any[] | null = null;
  try {
    const res = await client.from(table).select('id, deleted_at').in('id', ids);
    if (res.error || !res.data) return []; // fail-open : on pousse comme avant
    rows = res.data as any[];
  } catch {
    return []; // fail-open
  }
  const remoteDeleted = new Map<string, string>();
  for (const r of rows) if (r.deleted_at) remoteDeleted.set(r.id, r.deleted_at);
  if (remoteDeleted.size === 0) return [];
  const out: DeleteConflict[] = [];
  for (const e of entities) {
    const del = remoteDeleted.get(e.id);
    if (!del) continue;
    const delMs = Date.parse(del);
    if (isNaN(delMs)) continue; // tombstone distante illisible → on ignore
    const localMs = e.updatedAt ? Date.parse(e.updatedAt) : NaN;
    // Conflit si supprimée APRÈS notre édition, OU si on n'a pas d'horodatage local.
    if (isNaN(localMs) || delMs > localMs) out.push({ id: e.id, remoteDeletedAt: del });
  }
  return out;
}

/**
 * Restaure une entité (résolution « Restaurer ») : ré-upsert de la ligne locale
 * VIVANTE (deleted_at:null via pushChildTable), ce qui écrase délibérément la
 * tombstone distante. À appeler après avoir nettoyé recent/pending-deletes côté store
 * pour que la restauration « colle ».
 */
export async function restoreEntityAlive(
  treeId: string,
  entityType: 'person' | 'relationship',
  entity: Person | Relationship,
  client: any = supabase,
): Promise<void> {
  if (!client) return;
  if (entityType === 'person') {
    await pushChildTable('persons', [personToRow(entity as Person, treeId)], client);
  } else {
    await pushChildTable('relationships', [relToRow(entity as Relationship, treeId)], client);
  }
}

export async function saveTreeToSupabase(tree: FamilyTree, ownerId: string, isOwner = true, client: any = supabase): Promise<void> {
  if (!client) return;
  // For shared trees the recipient may only write children, never the owning `trees` row.
  if (isOwner) {
    // owner_id must be set EXACTLY ONCE, at creation. A plain upsert re-sent
    // `owner_id: ownerId` on every save, so a write triggered while a *different*
    // account was connected could rewrite the rightful owner — the tree then
    // disappeared for its real owner after a refresh. We therefore split the write:
    // INSERT sets owner_id (first save only); UPDATE never touches it.
    const { data: existing, error: selErr } = await client
      .from('trees').select('id').eq('id', tree.id).maybeSingle();
    if (selErr) { console.error('[sync] lecture tree échouée:', selErr.message, selErr.code ?? ''); throw selErr; }

    // Mutable fields, shared by both paths — never includes owner_id.
    const fields = {
      name: tree.name,
      description: tree.description ?? null,
      settings: { ...(tree.settings || {}), rootPersonId: tree.rootPersonId },
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // UPDATE — owner_id and created_at are left exactly as they are in the row.
      const { error } = await client.from('trees').update(fields).eq('id', tree.id);
      if (error) { console.error('[sync] update tree échoué:', error.message, error.code ?? ''); throw error; }
    } else {
      // INSERT — the only place owner_id is ever written.
      const { error } = await client.from('trees').insert({
        id: tree.id, owner_id: ownerId, created_at: tree.createdAt, ...fields,
      });
      if (error) { console.error('[sync] insert tree échoué:', error.message, error.code ?? ''); throw error; }
    }
  }
  await pushChildTable('persons', tree.persons.map(p => personToRow(p, tree.id)), client);
  await pushChildTable('relationships', tree.relationships.map(r => relToRow(r, tree.id)), client);
  await pushChildTable('journal_entries', (tree.journal || []).map(e => journalToRow(e, tree.id)), client);
}

export async function deleteTreeFromSupabase(treeId: string, ownerId?: string): Promise<{ error?: string }> {
  if (!supabase) return {};
  let q = supabase.from('trees').delete().eq('id', treeId); // children cascade via FKs
  if (ownerId) q = q.eq('owner_id', ownerId); // never delete someone else's tree
  const { error } = await q;
  return { error: error?.message };
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
  const allPersons = liveRows(persons.data).map(rowToPerson).filter(p => p.privacy !== 'private');
  const visibleIds = new Set(allPersons.map(p => p.id));
  const allRels = liveRows(rels.data).map(rowToRel)
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
