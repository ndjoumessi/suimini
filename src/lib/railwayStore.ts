/**
 * Backend Railway du `DataStore` (Phase 1) — SQL brut sur le pool `pg`.
 *
 * Reproduit À L'IDENTIQUE la sémantique de `supabaseSync` (UPSERT-only +
 * soft-delete tombstones + preserve-extra + owner_id écrit une seule fois) mais
 * SANS RLS : l'AutoriZation est portée par les prédicats `authz.ts` (l'appelant
 * est déjà autorisé par la route AVANT tout appel d'écriture).
 *
 * Réutilise les mappers PURS de supabaseSync (`personToRow`/`rowToPerson`…) →
 * l'invariant « les colonnes priment sur extra » a UNE seule source de vérité.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, withTransaction } from '@/lib/railwayDb';
import {
  personToRow, rowToPerson, relToRow, rowToRel, journalToRow, rowToJournal,
  type LoadResult, type SharedMeta, type DeleteConflict, type ChildTable,
} from '@/lib/supabaseSync';
import { type AuthzDataProvider, type Caller, type Permission, type MembershipStatus } from '@/lib/authz';
import type { PersonComment, PersonSuggestion } from '@/lib/collaboration';
import type { RpcResult, AddSuggestionInput } from '@/lib/dataStore';
import type { InviteResult, MemberRole, TreeMember } from '@/lib/sharing';
import type { FamilyTree, Person, Relationship } from '@/types';
import type { PoolClient } from 'pg';

// ── Provider d'autorisation Railway (miroir de createSupabaseAuthzProvider) ────
export function createRailwayAuthzProvider(): AuthzDataProvider {
  return {
    async getTreeOwnerId(treeId) {
      const rows = await query<{ owner_id: string }>('select owner_id from trees where id = $1', [treeId]);
      return rows[0]?.owner_id ?? null;
    },
    async getTreeSharePermission(treeId, email) {
      const rows = await query<{ permission: string }>(
        'select permission from tree_shares where tree_id = $1 and lower(shared_with_email) = lower($2)', [treeId, email],
      );
      const p = rows[0]?.permission;
      return p === 'read' || p === 'write' ? (p as Permission) : null;
    },
    async getMembershipStatus(treeId, userId) {
      const rows = await query<{ status: string }>(
        'select status from tree_members where tree_id = $1 and user_id = $2', [treeId, userId],
      );
      const s = rows[0]?.status;
      return s === 'pending' || s === 'accepted' || s === 'declined' ? (s as MembershipStatus) : null;
    },
    async isTreePublic(treeId) {
      const rows = await query<{ is_public: boolean }>('select is_public from trees where id = $1', [treeId]);
      return !!rows[0]?.is_public;
    },
  };
}

// ── Descripteurs de tables enfants (colonnes + colonnes jsonb à sérialiser) ────
type TableSpec = { cols: string[]; json: Set<string> };
const SPECS: Record<ChildTable, TableSpec> = {
  persons: {
    cols: ['id', 'tree_id', 'first_name', 'last_name', 'gender', 'birth_date', 'birth_place',
      'death_date', 'death_place', 'is_alive', 'occupation', 'bio', 'profile_photo', 'dna_origins',
      'citations', 'custom_fields', 'tags', 'privacy', 'extra', 'created_at', 'updated_at'],
    json: new Set(['birth_place', 'death_place', 'dna_origins', 'citations', 'custom_fields', 'tags', 'extra']),
  },
  relationships: {
    cols: ['id', 'tree_id', 'type', 'person1_id', 'person2_id', 'start_date', 'end_date', 'is_active', 'notes', 'extra'],
    json: new Set(['extra']),
  },
  journal_entries: {
    cols: ['id', 'tree_id', 'title', 'date', 'content', 'mentioned_person_ids', 'photos', 'created_at', 'updated_at'],
    json: new Set(['mentioned_person_ids', 'photos']),
  },
};

/** jsonb → chaîne JSON (node-pg convertirait un tableau JS en ARRAY Postgres, pas en jsonb). */
function bindVal(spec: TableSpec, col: string, v: unknown): unknown {
  if (v == null) return null;
  return spec.json.has(col) ? JSON.stringify(v) : v;
}

/**
 * UPSERT-only d'un lot de lignes (déjà mappées en snake_case). Pose deleted_at=null
 * (ranime une tombstone : présent localement = vivant). Multi-lignes en une requête.
 */
async function upsertRows(c: PoolClient, table: ChildTable, rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  const spec = SPECS[table];
  const allCols = [...spec.cols, 'deleted_at'];
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const ph = allCols.map((col) => {
      const v = col === 'deleted_at' ? null : bindVal(spec, col, row[col]);
      // created_at/updated_at absents → laisser le DEFAULT now() s'appliquer (comme
      // PostgREST qui omet le champ), au lieu d'insérer null (NOT NULL violation).
      if ((col === 'created_at' || col === 'updated_at') && v == null) return 'now()';
      values.push(v);
      return `$${values.length}`;
    });
    return `(${ph.join(',')})`;
  });
  const setClause = allCols.filter(c2 => c2 !== 'id')
    .map(col => `${col} = excluded.${col}`).join(', ');
  await c.query(
    `insert into ${table} (${allCols.join(',')}) values ${tuples.join(',')}
     on conflict (id) do update set ${setClause}
     -- Garde anti-hijack cross-tenant : si l'id upserté collisionne avec une
     -- ligne existante d'un AUTRE arbre, l'UPDATE devient un no-op au lieu
     -- d'écraser/voler son contenu (tree_id ne peut jamais être réassigné).
     where ${table}.tree_id = excluded.tree_id`,
    values,
  );
}

/**
 * preserve-extra : conserve les clés `extra` présentes EN BASE mais absentes du
 * push local (ex. nickName ajouté hors-app). Politique LOCAL PRIME. Fail-open.
 * Mute `rows[].extra` en place. (Miroir de supabaseSync.preserveRemoteExtra.)
 */
async function preserveExtra(c: PoolClient, table: ChildTable, rows: any[], treeId: string): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map(r => r.id);
  let remote: { id: string; extra: any }[];
  try {
    // Scoped par tree_id : sans ça, un id qui collisionne avec une ligne d'un
    // AUTRE arbre ferait fuiter son `extra` dans la ligne upsertée ici (voir
    // aussi la garde symétrique dans upsertRows).
    const res = await c.query<{ id: string; extra: any }>(`select id, extra from ${table} where id = any($1) and tree_id = $2`, [ids, treeId]);
    remote = res.rows;
  } catch { return; } // fail-open
  const remoteExtra = new Map<string, Record<string, unknown>>();
  for (const r of remote) if (r.extra && typeof r.extra === 'object') remoteExtra.set(r.id, r.extra);
  if (remoteExtra.size === 0) return;
  for (const row of rows) {
    const rem = remoteExtra.get(row.id);
    if (!rem) continue;
    const local = (row.extra && typeof row.extra === 'object') ? row.extra : {};
    const merged = { ...rem, ...local };
    row.extra = Object.keys(merged).length ? merged : null;
  }
}

/** Filtre les tombstones (soft-delete). */
function live(rows: any[]): any[] { return rows.filter(r => !r.deleted_at); }

export class RailwayStore {
  readonly backend = 'railway' as const;
  readonly authz = createRailwayAuthzProvider();

  async loadTrees(caller: Caller): Promise<LoadResult> {
    // Sans RLS, on reconstruit EXPLICITEMENT l'ensemble visible : owner OU membre
    // accepté OU partage par email. (Les arbres publics non liés ne polluent PAS
    // « mes arbres » — comportement voulu de loadTrees.)
    // Email vide → ne jamais matcher tree_shares dessus (un partage à email vide
    // serait un cas de données aberrant, mais autant ne pas lui laisser de prise).
    const treeRows = await query<any>(
      caller.email
        ? `select * from trees where owner_id = $1
             or id in (select tree_id from tree_members where user_id = $1 and status = 'accepted')
             or id in (select tree_id from tree_shares where lower(shared_with_email) = lower($2))`
        : `select * from trees where owner_id = $1
             or id in (select tree_id from tree_members where user_id = $1 and status = 'accepted')`,
      caller.email ? [caller.userId, caller.email] : [caller.userId],
    );
    if (treeRows.length === 0) return { trees: [], shared: {} };
    const treeIds = treeRows.map(t => t.id);
    const [persons, rels, journal] = await Promise.all([
      query<any>('select * from persons where tree_id = any($1)', [treeIds]),
      query<any>('select * from relationships where tree_id = any($1)', [treeIds]),
      query<any>('select * from journal_entries where tree_id = any($1)', [treeIds]),
    ]);
    const shared: Record<string, SharedMeta> = {};
    const trees: FamilyTree[] = treeRows.map(t => {
      // sharedByName vit dans profiles (Supabase, hors périmètre Railway) → repli
      // générique ici ; le nom exact reste résolu côté Supabase pour les arbres partagés.
      if (t.owner_id !== caller.userId) shared[t.id] = { sharedByName: 'un collaborateur' };
      return {
        id: t.id, name: t.name, description: t.description || undefined,
        settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
        rootPersonId: t.settings?.rootPersonId,
        persons: live(persons).filter(r => r.tree_id === t.id).map(rowToPerson),
        relationships: live(rels).filter(r => r.tree_id === t.id).map(rowToRel),
        journal: live(journal).filter(r => r.tree_id === t.id).map(rowToJournal),
      };
    });
    return { trees, shared };
  }

  async loadOneTree(treeId: string): Promise<FamilyTree | null> {
    const treeRows = await query<any>('select * from trees where id = $1', [treeId]);
    const t = treeRows[0];
    if (!t) return null;
    const [persons, rels, journal] = await Promise.all([
      query<any>('select * from persons where tree_id = $1', [treeId]),
      query<any>('select * from relationships where tree_id = $1', [treeId]),
      query<any>('select * from journal_entries where tree_id = $1', [treeId]),
    ]);
    return {
      id: t.id, name: t.name, description: t.description || undefined,
      settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
      rootPersonId: t.settings?.rootPersonId,
      persons: live(persons).map(rowToPerson),
      relationships: live(rels).map(rowToRel),
      journal: live(journal).map(rowToJournal),
    };
  }

  async saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean): Promise<void> {
    await withTransaction(async (c) => {
      if (isOwner) {
        const existing = await c.query('select id from trees where id = $1', [tree.id]);
        const settings = { ...(tree.settings || {}), rootPersonId: tree.rootPersonId };
        const nowIso = new Date().toISOString();
        if (existing.rows.length) {
          // owner_id/created_at JAMAIS retouchés (un partenaire write ne réécrit pas l'appartenance).
          await c.query(
            'update trees set name = $2, description = $3, settings = $4, updated_at = $5 where id = $1',
            [tree.id, tree.name, tree.description ?? null, JSON.stringify(settings), nowIso],
          );
        } else {
          await c.query(
            'insert into trees (id, owner_id, name, description, settings, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7)',
            [tree.id, ownerId, tree.name, tree.description ?? null, JSON.stringify(settings), tree.createdAt, nowIso],
          );
        }
      }
      const personRows = tree.persons.map(p => personToRow(p, tree.id));
      await preserveExtra(c, 'persons', personRows, tree.id);
      await upsertRows(c, 'persons', personRows);
      await upsertRows(c, 'relationships', tree.relationships.map(r => relToRow(r, tree.id)));
      await upsertRows(c, 'journal_entries', (tree.journal || []).map(e => journalToRow(e, tree.id)));
    });
  }

  async deleteTree(treeId: string, ownerId?: string): Promise<{ error?: string }> {
    try {
      // enfants en cascade (FK on delete cascade) ; owner_id borne (jamais l'arbre d'autrui).
      if (ownerId) await query('delete from trees where id = $1 and owner_id = $2', [treeId, ownerId]);
      else await query('delete from trees where id = $1', [treeId]);
      return {};
    } catch (e) {
      // Message générique au client (une erreur pg peut exposer des noms de
      // contraintes/colonnes) ; le détail reste dans les logs serveur.
      console.error('[railwayStore] deleteTree failed', e);
      return { error: 'Suppression échouée.' };
    }
  }

  async deleteChildRows(treeId: string, table: ChildTable, ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    if (!(table in SPECS)) return false;
    try {
      // Scopé par tree_id : sans ça, un id d'une AUTRE arborescence (ex.
      // récupéré sur un partage public) pourrait être soft-supprimé par
      // n'importe quel possesseur d'un arbre — voir revue de sécurité C1.
      await query(`update ${table} set deleted_at = now() where id = any($1) and tree_id = $2`, [ids, treeId]);
      return true;
    } catch { return false; }
  }

  async detectDeleteConflicts(
    treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[],
  ): Promise<DeleteConflict[]> {
    if (entities.length === 0 || !(table in SPECS)) return [];
    let rows: { id: string; deleted_at: string | null }[];
    try {
      rows = await query<{ id: string; deleted_at: string | null }>(
        `select id, deleted_at from ${table} where id = any($1) and tree_id = $2`, [entities.map(e => e.id), treeId],
      );
    } catch { return []; } // fail-open
    const remoteDeleted = new Map<string, string>();
    for (const r of rows) if (r.deleted_at) remoteDeleted.set(r.id, r.deleted_at);
    if (remoteDeleted.size === 0) return [];
    const out: DeleteConflict[] = [];
    for (const e of entities) {
      const del = remoteDeleted.get(e.id);
      if (!del) continue;
      const delMs = Date.parse(del);
      if (isNaN(delMs)) continue;
      const localMs = e.updatedAt ? Date.parse(e.updatedAt) : NaN;
      if (isNaN(localMs) || delMs > localMs) out.push({ id: e.id, remoteDeletedAt: del });
    }
    return out;
  }

  async restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship): Promise<void> {
    await withTransaction(async (c) => {
      if (entityType === 'person') await upsertRows(c, 'persons', [personToRow(entity as Person, treeId)]);
      else await upsertRows(c, 'relationships', [relToRow(entity as Relationship, treeId)]);
    });
  }

  // ── Collaboration ───────────────────────────────────────────────────────────
  // (AuthZ owner-only faite par la route AVANT ces appels ; mêmes formes que
  // les mappers de collaboration.ts — snake_case → camelCase.)

  async fetchComments(treeId: string, personId: string): Promise<PersonComment[]> {
    const rows = await query<any>(
      'select * from person_comments where tree_id = $1 and person_id = $2 order by created_at asc', [treeId, personId],
    );
    return rows.map(mapCommentRow);
  }
  async addComment(treeId: string, personId: string, content: string, author: { id: string; name: string }): Promise<PersonComment | null> {
    const trimmed = content.trim();
    if (!trimmed) return null;
    const rows = await query<any>(
      `insert into person_comments (tree_id, person_id, author_id, author_name, content)
       values ($1,$2,$3,$4,$5) returning *`,
      [treeId, personId, author.id, author.name, trimmed],
    );
    return rows[0] ? mapCommentRow(rows[0]) : null;
  }
  async fetchPendingSuggestions(treeId: string, personId?: string): Promise<PersonSuggestion[]> {
    const rows = personId
      ? await query<any>('select * from person_suggestions where tree_id = $1 and status = $2 and person_id = $3 order by created_at asc', [treeId, 'pending', personId])
      : await query<any>('select * from person_suggestions where tree_id = $1 and status = $2 order by created_at asc', [treeId, 'pending']);
    return rows.map(mapSuggestionRow);
  }
  async countPendingSuggestions(treeId: string): Promise<number> {
    const rows = await query<{ n: string }>("select count(*)::int as n from person_suggestions where tree_id = $1 and status = 'pending'", [treeId]);
    return Number(rows[0]?.n ?? 0);
  }
  async addSuggestion(s: AddSuggestionInput): Promise<PersonSuggestion | null> {
    const rows = await query<any>(
      `insert into person_suggestions (tree_id, person_id, author_id, author_name, field, current_value, suggested_value)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [s.treeId, s.personId, s.author.id, s.author.name, s.field, s.currentValue, s.suggestedValue],
    );
    return rows[0] ? mapSuggestionRow(rows[0]) : null;
  }
  async resolveSuggestion(id: string, status: 'accepted' | 'rejected'): Promise<boolean> {
    try { await query('update person_suggestions set status = $2 where id = $1', [id, status]); return true; }
    catch { return false; }
  }
  async getSuggestionTreeId(id: string): Promise<string | null> {
    const rows = await query<{ tree_id: string }>('select tree_id from person_suggestions where id = $1', [id]);
    return rows[0]?.tree_id ?? null;
  }

  async inviteMember(treeId: string, email: string, role: MemberRole, invitedBy: string): Promise<InviteResult | null> {
    const clean = email.trim().toLowerCase();
    if (!clean) return null;
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await query<any>(
      `insert into tree_members (tree_id, email, role, invited_by, status, token, expires_at)
       values ($1,$2,$3,$4,'pending',$5,$6)
       on conflict (tree_id, email) do update set
         role = excluded.role, invited_by = excluded.invited_by, status = 'pending',
         token = excluded.token, expires_at = excluded.expires_at
       returning *`,
      [treeId, clean, role, invitedBy, token, expiresAt],
    );
    const r = rows[0];
    if (!r) return null;
    return { member: mapMemberRow(r), token: r.token ?? token };
  }

  async getMyMemberships(userId: string): Promise<TreeMember[]> {
    const rows = await query<any>(
      "select * from tree_members where user_id = $1 and status = 'accepted'", [userId],
    );
    return rows.map(mapMemberRow);
  }

  // ── Partage par email (tree_shares) + lien public (F1 fix) ───────────────────
  // Miroir des fonctions Supabase du même nom (`supabaseSync.ts`) — AuthZ owner-only
  // faite par la route (`guardTreeWrite(id,'owner')`), jamais ici.

  async shareTree(treeId: string, email: string, permission: 'read' | 'write'): Promise<{ error?: string }> {
    try {
      await query(
        `insert into tree_shares (tree_id, shared_with_email, permission)
         values ($1, lower($2), $3)
         on conflict (tree_id, shared_with_email) do update set permission = excluded.permission`,
        [treeId, email.trim(), permission],
      );
      return {};
    } catch (e) {
      console.error('[railwayStore] shareTree failed', e);
      return { error: 'Partage échoué.' };
    }
  }

  async listShares(treeId: string): Promise<{ email: string; permission: string }[]> {
    return query<{ email: string; permission: string }>(
      'select shared_with_email as email, permission from tree_shares where tree_id = $1', [treeId],
    );
  }

  async unshareTree(treeId: string, email: string): Promise<void> {
    await query('delete from tree_shares where tree_id = $1 and lower(shared_with_email) = lower($2)', [treeId, email]);
  }

  async getPublicShare(treeId: string): Promise<{ isPublic: boolean; slug: string | null }> {
    const rows = await query<{ is_public: boolean; public_slug: string | null }>(
      'select is_public, public_slug from trees where id = $1', [treeId],
    );
    return { isPublic: !!rows[0]?.is_public, slug: rows[0]?.public_slug ?? null };
  }

  /** Garde le slug à l'extinction (comportement identique à la version Supabase,
   * supabaseSync.ts) — réactiver réutilise le même lien plutôt que d'en régénérer un. */
  async setTreePublic(treeId: string, isPublic: boolean, slug?: string | null): Promise<{ error?: string }> {
    try {
      if (isPublic && slug) {
        await query('update trees set is_public = $2, public_slug = $3 where id = $1', [treeId, isPublic, slug]);
      } else {
        await query('update trees set is_public = $2 where id = $1', [treeId, isPublic]);
      }
      return {};
    } catch (e) {
      console.error('[railwayStore] setTreePublic failed', e);
      return { error: 'Mise à jour échouée.' };
    }
  }

  /** Lecture ANONYME par slug (page /arbre/[slug]) — même masquage par-fiche
   * (privacy) que la version Supabase, journal jamais exposé publiquement. */
  async loadPublicTree(slug: string): Promise<FamilyTree | null> {
    const treeRows = await query<any>(
      `select id, name, description, settings, created_at, updated_at
         from trees where public_slug = $1 and is_public = true`, [slug],
    );
    const t = treeRows[0];
    if (!t) return null;
    const [persons, rels] = await Promise.all([
      query<any>('select * from persons where tree_id = $1', [t.id]),
      query<any>('select * from relationships where tree_id = $1', [t.id]),
    ]);
    const allPersons = live(persons).map(rowToPerson).filter(p => p.privacy !== 'private');
    const visibleIds = new Set(allPersons.map(p => p.id));
    const allRels = live(rels).map(rowToRel)
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

  // ── RPC data-plane (membres/invitations) ─────────────────────────────────────
  // Miroir des RPC SECURITY DEFINER 0013 : `auth.uid()` remplacé par `caller`.

  async rpc(name: string, args: Record<string, unknown>, caller: Caller | null): Promise<RpcResult> {
    try {
      // F2 fix : seule `get_invitation` est appelable anonyme (pré-login, page
      // /invite/[token]) — la route serveur ne laisse passer que celle-là sans
      // session (voir ANON_ALLOWED dans /api/data/rpc/[name]/route.ts), mais on
      // re-vérifie ici en dur : un `caller` manquant sur n'importe quel autre nom
      // doit échouer proprement plutôt que de crasher sur `caller.userId`.
      if (!caller && name !== 'get_invitation') {
        return { data: null, error: { message: 'Non authentifié.' } };
      }
      switch (name) {
        case 'get_tree_members': return { data: await this.getTreeMembers(String(args.p_tree_id), caller as Caller), error: null };
        case 'update_member_role': return await this.updateMemberRole(String(args.p_tree_id), String(args.p_email), String(args.p_role), caller as Caller);
        case 'remove_member': return await this.removeMember(String(args.p_tree_id), String(args.p_email), caller as Caller);
        case 'my_tree_role': return { data: await this.myTreeRole(String(args.p_tree_id), caller as Caller), error: null };
        case 'accept_invitation': return { data: await this.acceptInvitation(String(args.p_token), caller as Caller), error: null };
        case 'get_invitation': return { data: await this.getInvitation(String(args.p_token)), error: null };
        default: return { data: null, error: { message: `RPC ${name} non implémentée pour Railway.` } };
      }
    } catch (e) {
      console.error(`[railwayStore] rpc ${name} failed`, e);
      return { data: null, error: { message: 'RPC échouée.' } };
    }
  }

  /** Owner OU membre accepté 'admin'. */
  private async canManageMembers(treeId: string, caller: Caller): Promise<boolean> {
    const rows = await query<{ ok: boolean }>(
      `select exists(
         select 1 from trees where id = $1 and owner_id = $2
         union all
         select 1 from tree_members where tree_id = $1 and user_id = $2 and status = 'accepted' and role = 'admin'
       ) as ok`, [treeId, caller.userId],
    );
    return !!rows[0]?.ok;
  }

  private async getTreeMembers(treeId: string, caller: Caller) {
    if (!(await this.canManageMembers(treeId, caller))) throw new Error('Unauthorized');
    return query<any>(
      'select email, role, status, invited_at, accepted_at from tree_members where tree_id = $1 order by invited_at desc', [treeId],
    );
  }
  private async updateMemberRole(treeId: string, email: string, role: string, caller: Caller): Promise<RpcResult> {
    if (!(await this.canManageMembers(treeId, caller))) return { data: null, error: { message: 'Unauthorized' } };
    if (!['viewer', 'editor', 'admin'].includes(role)) return { data: null, error: { message: 'Rôle invalide.' } };
    await query('update tree_members set role = $3 where tree_id = $1 and lower(email) = lower($2)', [treeId, email, role]);
    return { data: null, error: null };
  }
  private async removeMember(treeId: string, email: string, caller: Caller): Promise<RpcResult> {
    if (!(await this.canManageMembers(treeId, caller))) return { data: null, error: { message: 'Unauthorized' } };
    await query('delete from tree_members where tree_id = $1 and lower(email) = lower($2)', [treeId, email]);
    return { data: null, error: null };
  }
  private async myTreeRole(treeId: string, caller: Caller): Promise<string | null> {
    const owner = await query<{ owner_id: string }>('select owner_id from trees where id = $1', [treeId]);
    if (owner[0]?.owner_id === caller.userId) return 'owner';
    const m = await query<{ role: string }>(
      "select role from tree_members where tree_id = $1 and user_id = $2 and status = 'accepted'", [treeId, caller.userId],
    );
    return m[0]?.role ?? null;
  }
  private async acceptInvitation(token: string, caller: Caller): Promise<Array<{ tree_id: string; tree_name: string; role: string }>> {
    return withTransaction(async (c) => {
      const inv = await c.query<any>('select * from tree_members where token = $1', [token]);
      const row = inv.rows[0];
      if (!row) throw new Error('Invitation introuvable.');
      if (row.expires_at && Date.parse(row.expires_at) < Date.now()) throw new Error('Invitation expirée.');
      await c.query(
        "update tree_members set status = 'accepted', user_id = $2, accepted_at = now() where token = $1", [token, caller.userId],
      );
      const t = await c.query<{ name: string }>('select name from trees where id = $1', [row.tree_id]);
      return [{ tree_id: row.tree_id, tree_name: t.rows[0]?.name ?? '', role: row.role }];
    });
  }
  private async getInvitation(token: string): Promise<Array<any>> {
    const rows = await query<any>(
      `select tm.role, tm.status, tm.email as invited_email, tm.expires_at, t.name as tree_name
         from tree_members tm join trees t on t.id = tm.tree_id where tm.token = $1`, [token],
    );
    if (!rows[0]) return [];
    // inviter_name vit dans profiles (Supabase, hors périmètre Railway) → null ici.
    // Suivi : enrichir via get_public_profiles.
    // (F2, corrigé : ce chemin EST désormais atteignable par un visiteur anonyme —
    // voir ANON_ALLOWED dans /api/data/rpc/[name]/route.ts et le commentaire sur
    // sharing.ts:getInvitation. Il n'y a plus d'allowlist qui le limiterait.)
    return [{ ...rows[0], inviter_name: null }];
  }
}

function mapCommentRow(r: any): PersonComment {
  return { id: r.id, treeId: r.tree_id, personId: r.person_id, authorId: r.author_id, authorName: r.author_name, content: r.content, createdAt: r.created_at };
}
function mapSuggestionRow(r: any): PersonSuggestion {
  return {
    id: r.id, treeId: r.tree_id, personId: r.person_id, authorId: r.author_id, authorName: r.author_name,
    field: r.field, currentValue: r.current_value, suggestedValue: r.suggested_value, status: r.status, createdAt: r.created_at,
  };
}
function mapMemberRow(r: any): TreeMember {
  return {
    id: r.id, treeId: r.tree_id, userId: r.user_id, email: r.email, role: r.role,
    invitedBy: r.invited_by, invitedAt: r.invited_at, acceptedAt: r.accepted_at, status: r.status,
  };
}
