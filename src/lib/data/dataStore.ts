/**
 * Frontière BACKEND côté serveur (Phase 1 — migration Railway).
 *
 * Les routes `/api/data/*` ne parlent plus directement à Supabase pour les DONNÉES
 * d'arbre : elles obtiennent un `DataStore` via `getDataStore(client, caller)`.
 * Deux implémentations :
 *   • SupabaseStore — délègue aux fonctions injectables de `supabaseSync` /
 *     `collaboration` avec le client Supabase de l'appelant. Comportement IDENTIQUE
 *     à l'origine → chemin de ROLLBACK (RLS reste le filet).
 *   • RailwayStore  — SQL brut sur le pool `pg` Railway (chargé paresseusement).
 *     PAS de RLS : l'AuthZ applicative (authz.ts) est l'unique gardien.
 *
 * Sélection par `DB_BACKEND` (env serveur, JAMAIS NEXT_PUBLIC) :
 *   • absent | 'supabase'  → SupabaseStore (défaut sûr / rollback)
 *   • 'railway'            → RailwayStore, MAIS uniquement si l'appelant est dans
 *                            l'allowlist `DB_BACKEND_ALLOWLIST` (canary ciblé) ;
 *                            allowlist vide = tous. Sinon SupabaseStore.
 *
 * ⚠️ L'IDENTITÉ (profiles, auth, RPC admin) reste sur Supabase même en mode railway :
 * `getDataStore` ne couvre QUE le plan données d'arbre. Le client Supabase de
 * l'appelant est donc toujours passé — les chemins hors-périmètre l'utilisent.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  loadTreesFromSupabase, loadOneTree as loadOneTreeSupa, saveTreeToSupabase,
  deleteChildRows as deleteChildRowsSupa, detectDeleteConflicts as detectConflictsSupa,
  restoreEntityAlive,
  shareTree as shareTreeSupa, listShares as listSharesSupa, unshareTree as unshareTreeSupa,
  getPublicShare as getPublicShareSupa, setTreePublic as setTreePublicSupa,
  loadPublicTree as loadPublicTreeSupa,
  type LoadResult, type DeleteConflict, type ChildTable,
} from '@/lib/data/supabaseSync';
import {
  createSupabaseAuthzProvider, type AuthzDataProvider, type Caller,
} from '@/lib/data/authz';
import {
  fetchCommentsDirect, addCommentDirect,
  fetchPendingSuggestionsDirect, countPendingSuggestionsDirect, addSuggestionDirect, resolveSuggestionDirect,
  type PersonComment, type PersonSuggestion,
} from '@/lib/data/collaboration';
import { inviteMemberDirect, mapRow as mapMemberRow, type InviteResult, type MemberRole, type TreeMember } from '@/lib/data/sharing';
import { railwayConfigured } from '@/lib/data/railwayDb';
import type { FamilyTree, Person, Relationship } from '@/types';

export type Backend = 'supabase' | 'railway';

export interface RpcResult { data: any; error: { message: string } | null }
export interface AddSuggestionInput {
  treeId: string; personId: string; field: string; currentValue: string | null; suggestedValue: string;
  author: { id: string; name: string };
}
/** RPC data-plane forwardées vers le store (les RPC admin/profil restent Supabase). */
export const DATA_PLANE_RPCS = new Set([
  'get_tree_members', 'update_member_role', 'remove_member', 'my_tree_role', 'get_invitation', 'accept_invitation',
]);

/** Opérations DONNÉES d'arbre, backend-agnostiques. Miroir de l'interface navigateur
 * `DataClient` (dataClient.ts), côté serveur. */
export interface DataStore {
  readonly backend: Backend;
  /** Faits d'autorisation (owner/share/membre/public) pour les prédicats authz.ts. */
  readonly authz: AuthzDataProvider;

  loadTrees(caller: Caller): Promise<LoadResult>;
  loadOneTree(treeId: string): Promise<FamilyTree | null>;
  saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean): Promise<void>;
  deleteTree(treeId: string, ownerId?: string): Promise<{ error?: string }>;
  deleteChildRows(treeId: string, table: ChildTable, ids: string[]): Promise<boolean>;
  detectDeleteConflicts(treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[]): Promise<DeleteConflict[]>;
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship): Promise<void>;

  // Collaboration (commentaires + suggestions). AuthZ owner-only faite par la route.
  fetchComments(treeId: string, personId: string): Promise<PersonComment[]>;
  addComment(treeId: string, personId: string, content: string, author: { id: string; name: string }): Promise<PersonComment | null>;
  fetchPendingSuggestions(treeId: string, personId?: string): Promise<PersonSuggestion[]>;
  countPendingSuggestions(treeId: string): Promise<number>;
  addSuggestion(input: AddSuggestionInput): Promise<PersonSuggestion | null>;
  resolveSuggestion(id: string, status: 'accepted' | 'rejected'): Promise<boolean>;
  /** tree_id d'une suggestion (la route resolve vérifie ensuite isTreeOwner). */
  getSuggestionTreeId(id: string): Promise<string | null>;

  /** Inviter/ré-inviter un membre par email (upsert tree_members). AuthZ owner par la route. */
  inviteMember(treeId: string, email: string, role: MemberRole, invitedBy: string): Promise<InviteResult | null>;
  /** Mes appartenances acceptées (tree_members WHERE user_id = caller AND status=accepted). Fail-open. */
  getMyMemberships(userId: string): Promise<TreeMember[]>;

  // RPC data-plane (membres/invitations) forwardées sous l'identité de l'appelant.
  // `caller` peut être `null` : seule `get_invitation` (F2) est appelable anonyme,
  // les autres cas exigent un caller réel et rejettent sinon (voir RailwayStore.rpc).
  rpc(name: string, args: Record<string, unknown>, caller: Caller | null): Promise<RpcResult>;

  // Partage par email (tree_shares) + lien public (trees.is_public/public_slug).
  // F1 fix : AuthZ owner-only faite par la route (guardTreeWrite(id,'owner')).
  shareTree(treeId: string, email: string, permission: 'read' | 'write'): Promise<{ error?: string }>;
  listShares(treeId: string): Promise<{ email: string; permission: string }[]>;
  unshareTree(treeId: string, email: string): Promise<void>;
  getPublicShare(treeId: string): Promise<{ isPublic: boolean; slug: string | null }>;
  setTreePublic(treeId: string, isPublic: boolean, slug?: string | null): Promise<{ error?: string }>;
  /** Lecture ANONYME par slug (page /arbre/[slug]) — masquage par-fiche (privacy)
   * appliqué dans l'implémentation, jamais de journal exposé publiquement. */
  loadPublicTree(slug: string): Promise<FamilyTree | null>;
}

/** Backend Supabase : passe-plat vers supabaseSync sous le client de l'appelant.
 * `treeId` reçu pour l'interface mais ignoré (RLS scope déjà par ligne). */
export class SupabaseStore implements DataStore {
  readonly backend = 'supabase' as const;
  readonly authz: AuthzDataProvider;
  constructor(private client: any) {
    this.authz = createSupabaseAuthzProvider(client);
  }
  loadTrees(caller: Caller) { return loadTreesFromSupabase(caller.userId, this.client); }
  loadOneTree(treeId: string) { return loadOneTreeSupa(treeId, this.client); }
  saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean) { return saveTreeToSupabase(tree, ownerId, isOwner, this.client); }
  async deleteTree(treeId: string, ownerId?: string) {
    // Sous le client appelant (RLS filtre) ; owner_id borne en plus (jamais l'arbre d'autrui).
    let q = this.client.from('trees').delete().eq('id', treeId);
    if (ownerId) q = q.eq('owner_id', ownerId);
    const { error } = await q;
    return { error: error?.message as string | undefined };
  }
  deleteChildRows(_treeId: string, table: ChildTable, ids: string[]) { return deleteChildRowsSupa(table, ids, this.client); }
  detectDeleteConflicts(_treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[]) { return detectConflictsSupa(table, entities, this.client); }
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship) { return restoreEntityAlive(treeId, entityType, entity, this.client); }

  fetchComments(treeId: string, personId: string) { return fetchCommentsDirect(treeId, personId, this.client); }
  addComment(treeId: string, personId: string, content: string, author: { id: string; name: string }) { return addCommentDirect(treeId, personId, content, author, this.client); }
  fetchPendingSuggestions(treeId: string, personId?: string) { return fetchPendingSuggestionsDirect(treeId, personId, this.client); }
  countPendingSuggestions(treeId: string) { return countPendingSuggestionsDirect(treeId, this.client); }
  addSuggestion(input: AddSuggestionInput) { return addSuggestionDirect(input, this.client); }
  resolveSuggestion(id: string, status: 'accepted' | 'rejected') { return resolveSuggestionDirect(id, status, this.client); }
  async getSuggestionTreeId(id: string) {
    const { data } = await this.client.from('person_suggestions').select('tree_id').eq('id', id).maybeSingle();
    return (data?.tree_id as string | undefined) ?? null;
  }
  inviteMember(treeId: string, email: string, role: MemberRole, invitedBy: string) {
    return inviteMemberDirect({ treeId, email, role, invitedBy }, this.client);
  }
  async getMyMemberships(userId: string) {
    const { data, error } = await this.client.from('tree_members').select('*')
      .eq('user_id', userId).eq('status', 'accepted');
    if (error || !data) return [];
    return (data as any[]).map(mapMemberRow);
  }
  async rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.client.rpc(name, args);
    return { data: data ?? null, error: error ? { message: error.message as string } : null };
  }

  shareTree(treeId: string, email: string, permission: 'read' | 'write') {
    return shareTreeSupa(treeId, email, permission, this.client);
  }
  listShares(treeId: string) { return listSharesSupa(treeId, this.client); }
  unshareTree(treeId: string, email: string) { return unshareTreeSupa(treeId, email, this.client); }
  getPublicShare(treeId: string) { return getPublicShareSupa(treeId, this.client); }
  setTreePublic(treeId: string, isPublic: boolean, slug?: string | null) {
    return setTreePublicSupa(treeId, isPublic, slug, this.client);
  }
  loadPublicTree(slug: string) { return loadPublicTreeSupa(slug, this.client); }
}

// ── Sélecteur de backend ─────────────────────────────────────────────────────

/** Lit DB_BACKEND (défaut 'supabase'). */
function configuredBackend(): Backend {
  return process.env.DB_BACKEND === 'railway' ? 'railway' : 'supabase';
}

/** Allowlist du canary : `DB_BACKEND_ALLOWLIST` = userIds séparés par des virgules.
 * Vide/absent = tous autorisés (bascule globale). */
function allowlist(): string[] {
  return (process.env.DB_BACKEND_ALLOWLIST ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

/** Backend EFFECTIF pour cet appelant (résout allowlist + config Railway présente). */
export function resolveBackend(caller: Caller | null): Backend {
  if (configuredBackend() !== 'railway') return 'supabase';
  if (!railwayConfigured()) return 'supabase';          // fail-safe : pas de chaîne → supabase
  const allow = allowlist();
  if (allow.length && (!caller || !allow.includes(caller.userId))) return 'supabase';
  return 'railway';
}

/**
 * Frontière UNIQUE côté serveur. Retourne le store du backend effectif pour cet
 * appelant. RailwayStore est importé PARESSEUSEMENT (pg n'est chargé qu'en mode
 * railway → aucun impact sur le bundle/perf du chemin Supabase par défaut).
 */
export async function getDataStore(client: any, caller: Caller | null): Promise<DataStore> {
  if (resolveBackend(caller) === 'railway') {
    const { RailwayStore } = await import('@/lib/data/railwayStore');
    return new RailwayStore();
  }
  return new SupabaseStore(client);
}
