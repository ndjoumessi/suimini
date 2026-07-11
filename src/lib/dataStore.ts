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
  type LoadResult, type DeleteConflict, type ChildTable,
} from '@/lib/supabaseSync';
import {
  createSupabaseAuthzProvider, type AuthzDataProvider, type Caller,
} from '@/lib/authz';
import { railwayConfigured } from '@/lib/railwayDb';
import type { FamilyTree, Person, Relationship } from '@/types';

export type Backend = 'supabase' | 'railway';

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
}

// ── Sélecteur de backend ─────────────────────────────────────────────────────

/** Lit DB_BACKEND (défaut 'supabase'). */
export function configuredBackend(): Backend {
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
    const { RailwayStore } = await import('@/lib/railwayStore');
    return new RailwayStore();
  }
  return new SupabaseStore(client);
}
