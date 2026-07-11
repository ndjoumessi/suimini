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
     on conflict (id) do update set ${setClause}`,
    values,
  );
}

/**
 * preserve-extra : conserve les clés `extra` présentes EN BASE mais absentes du
 * push local (ex. nickName ajouté hors-app). Politique LOCAL PRIME. Fail-open.
 * Mute `rows[].extra` en place. (Miroir de supabaseSync.preserveRemoteExtra.)
 */
async function preserveExtra(c: PoolClient, table: ChildTable, rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map(r => r.id);
  let remote: { id: string; extra: any }[];
  try {
    const res = await c.query<{ id: string; extra: any }>(`select id, extra from ${table} where id = any($1)`, [ids]);
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
    const treeRows = await query<any>(
      `select * from trees where owner_id = $1
         or id in (select tree_id from tree_members where user_id = $1 and status = 'accepted')
         or id in (select tree_id from tree_shares where lower(shared_with_email) = lower($2))`,
      [caller.userId, caller.email],
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
      await preserveExtra(c, 'persons', personRows);
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
      return { error: e instanceof Error ? e.message : 'Suppression échouée.' };
    }
  }

  async deleteChildRows(_treeId: string, table: ChildTable, ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    if (!(table in SPECS)) return false;
    try {
      await query(`update ${table} set deleted_at = now() where id = any($1)`, [ids]);
      return true;
    } catch { return false; }
  }

  async detectDeleteConflicts(
    _treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[],
  ): Promise<DeleteConflict[]> {
    if (entities.length === 0 || !(table in SPECS)) return [];
    let rows: { id: string; deleted_at: string | null }[];
    try {
      rows = await query<{ id: string; deleted_at: string | null }>(
        `select id, deleted_at from ${table} where id = any($1)`, [entities.map(e => e.id)],
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
}
