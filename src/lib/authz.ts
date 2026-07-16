/**
 * Phase 0 — Autorisation applicative, MIROIR EXACT des policies RLS.
 *
 * Objectif : quand RLS disparaîtra (cutover Railway), ces prédicats deviendront
 * l'unique gardien. Ils sont donc DB-agnostiques : toute lecture de fait
 * (propriété, partage, appartenance, public) passe par un `AuthzDataProvider`
 * injectable.
 *   • Phase 0 → `createSupabaseAuthzProvider(client)` : lit les faits PROPRES à
 *     l'appelant via son client Supabase (RLS reste le filet). Option A du design.
 *   • Cutover Railway → provider branché sur la connexion DB privilégiée. La
 *     LOGIQUE des prédicats ci-dessous ne change pas.
 *
 * ⚠️ Modèle EFFECTIF reproduit (OR de toutes les policies, cf. supabase/*.sql) :
 *   - persons/relationships READ : owner OU tree_shares(read|write) OU membre
 *     ACCEPTÉ OU public (masquage par-fiche : privé jamais exposé).
 *   - journal READ : owner OU tree_shares(read|write) UNIQUEMENT (ni membre,
 *     ni public).
 *   - content WRITE (persons/relationships/journal) : owner OU tree_shares=write.
 *     Les MEMBRES sont LECTURE SEULE (aucune write policy membre à ce jour).
 *   - tree metadata / delete : owner UNIQUEMENT.
 *   - profile READ : soi-même (les pairs → RPC get_public_profiles).
 *   - le rôle admin NE donne AUCUN accès aux données d'arbre (les RPC admin sont
 *     SECURITY DEFINER et gèrent leur propre AuthZ).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Person, Relationship } from '@/types';

export type Permission = 'read' | 'write';
export type Role = 'user' | 'admin' | 'superadmin';
export type MembershipStatus = 'pending' | 'accepted' | 'declined';

/** Appelant authentifié ; `null` = anonyme (lien public). */
export interface Caller { userId: string; email: string; role: Role }
export type MaybeCaller = Caller | null;

/** Faits d'autorisation. En Phase 0, ces lectures sont PROPRES à l'appelant
 * (RLS les autorise) ; post-Railway, lectures privilégiées directes. */
export interface AuthzDataProvider {
  getTreeOwnerId(treeId: string): Promise<string | null>;
  getTreeSharePermission(treeId: string, email: string): Promise<Permission | null>;
  getMembershipStatus(treeId: string, userId: string): Promise<MembershipStatus | null>;
  isTreePublic(treeId: string): Promise<boolean>;
}

// ── Briques ──────────────────────────────────────────────────────────────────
async function isOwner(p: AuthzDataProvider, treeId: string, c: MaybeCaller): Promise<boolean> {
  return !!c && (await p.getTreeOwnerId(treeId)) === c.userId;
}
async function isAcceptedMember(p: AuthzDataProvider, treeId: string, c: MaybeCaller): Promise<boolean> {
  return !!c && (await p.getMembershipStatus(treeId, c.userId)) === 'accepted';
}
/** tree_shares : 'write' satisfait 'read' ; 'read' ne satisfait pas 'write'. */
async function hasShare(p: AuthzDataProvider, treeId: string, c: MaybeCaller, min: Permission): Promise<boolean> {
  if (!c) return false;
  const perm = await p.getTreeSharePermission(treeId, c.email);
  if (perm === 'write') return true;
  return min === 'read' && perm === 'read';
}

// ── Prédicats publics (utilisés par les endpoints) ───────────────────────────

/**
 * Lecture AUTHENTIFIÉE et NON MASQUÉE d'un arbre (endpoint /api/data/trees/[id]) :
 * owner OU tree_shares(read|write) OU membre accepté. **PAS le public** — un
 * lecteur public passe par l'endpoint dédié avec masquage par-fiche
 * (isTreePublic + isPersonPubliclyVisible), jamais par ce chemin non masqué
 * (sinon une fiche privée d'un arbre public fuiterait une fois RLS retiré).
 */
export async function canReadTreeAsMember(p: AuthzDataProvider, treeId: string, c: MaybeCaller): Promise<boolean> {
  if (await isOwner(p, treeId, c)) return true;
  if (await hasShare(p, treeId, c, 'read')) return true;
  return isAcceptedMember(p, treeId, c);
}

/** content WRITE : owner OU share=write. PAS les membres (lecture seule). */
export async function canWriteTreeContent(p: AuthzDataProvider, treeId: string, c: MaybeCaller): Promise<boolean> {
  if (await isOwner(p, treeId, c)) return true;
  return hasShare(p, treeId, c, 'write');
}

/** journal READ : owner OU tree_shares(read|write) UNIQUEMENT. */
export async function canReadJournal(p: AuthzDataProvider, treeId: string, c: MaybeCaller): Promise<boolean> {
  if (await isOwner(p, treeId, c)) return true;
  return hasShare(p, treeId, c, 'read');
}

/**
 * Retire `journal` (→ `[]`) des arbres où l'appelant N'A PAS l'accès journal
 * (`canReadJournal` ci-dessus — jamais un simple membre accepté). Sur Supabase,
 * la policy `journal_select` fait déjà ce filtrage en amont (RLS) ; sur Railway,
 * il n'y a PAS de RLS, donc `RailwayStore.loadTrees`/`loadOneTree` renvoient le
 * journal SANS filtrage par appelant — cette fonction est la SEULE ligne de
 * défense sur ce backend (sécu F1 : le journal fuitait aux membres acceptés).
 * Utilisée par les routes `/api/data/trees` et `/api/data/trees/[id]` juste
 * avant la réponse JSON ; appliquée aux deux backends par simplicité/défense en
 * profondeur (redondante mais inoffensive côté Supabase, où RLS a déjà tranché).
 */
export async function stripUnauthorizedJournal<T extends { id: string; journal?: unknown[] }>(
  p: AuthzDataProvider, trees: T[], c: MaybeCaller,
): Promise<void> {
  await Promise.all(trees.map(async (tree) => {
    if (!(await canReadJournal(p, tree.id, c))) tree.journal = [];
  }));
}

/** métadonnées d'arbre (update/delete/insert) : owner UNIQUEMENT. */
export async function isTreeOwner(p: AuthzDataProvider, treeId: string, c: MaybeCaller): Promise<boolean> {
  return isOwner(p, treeId, c);
}

/** profil : lecture de soi-même seulement (pairs → RPC get_public_profiles). */
export function canReadOwnProfile(c: MaybeCaller, targetUserId: string): boolean {
  return !!c && c.userId === targetUserId;
}

export function isAdmin(c: MaybeCaller): boolean {
  return !!c && (c.role === 'admin' || c.role === 'superadmin');
}
export function isSuperAdmin(c: MaybeCaller): boolean {
  return !!c && c.role === 'superadmin';
}

// ── Masquage lecture publique (mirroir persons/relationships_public_read) ─────

/** Une fiche privée n'est JAMAIS exposée via un lien public. */
export function isPersonPubliclyVisible(person: Pick<Person, 'privacy'>): boolean {
  return (person.privacy ?? 'public') !== 'private';
}

/** Une relation n'est exposée publiquement que si AUCUN des deux liés n'est privé
 * (sinon on déduirait l'existence d'une fiche privée). */
export function isRelationshipPubliclyVisible(
  rel: Pick<Relationship, 'person1Id' | 'person2Id'>,
  personsById: Map<string, Pick<Person, 'privacy'>>,
): boolean {
  const a = personsById.get(rel.person1Id);
  const b = personsById.get(rel.person2Id);
  return isPersonPubliclyVisible(a ?? {}) && isPersonPubliclyVisible(b ?? {});
}

// ── Provider Phase 0 (option A) : lit les faits de l'appelant via son client ──
// Utilisé par les endpoints (PR3+). Les lectures sont autorisées par RLS pour
// l'appelant lui-même (sa part, son appartenance, la propriété/le public de l'arbre).
export function createSupabaseAuthzProvider(client: any): AuthzDataProvider {
  return {
    async getTreeOwnerId(treeId) {
      const { data } = await client.from('trees').select('owner_id').eq('id', treeId).maybeSingle();
      return (data?.owner_id as string | undefined) ?? null;
    },
    async getTreeSharePermission(treeId, email) {
      const { data } = await client.from('tree_shares').select('permission')
        .eq('tree_id', treeId).eq('shared_with_email', email).maybeSingle();
      const perm = data?.permission as string | undefined;
      return perm === 'read' || perm === 'write' ? perm : null;
    },
    async getMembershipStatus(treeId, userId) {
      const { data } = await client.from('tree_members').select('status')
        .eq('tree_id', treeId).eq('user_id', userId).maybeSingle();
      const s = data?.status as string | undefined;
      return s === 'pending' || s === 'accepted' || s === 'declined' ? s : null;
    },
    async isTreePublic(treeId) {
      const { data } = await client.from('trees').select('is_public').eq('id', treeId).maybeSingle();
      return !!data?.is_public;
    },
  };
}
