/**
 * Phase 0 — frontière RÉSEAU unique de la couche données.
 *
 * Tout le store (`useFamilyStore`) parle désormais à un `DataClient`, plus jamais
 * à Supabase en direct. Deux implémentations coexisteront :
 *   • SupabaseDataClient — délègue aux fonctions `supabaseSync` actuelles (client
 *     Supabase du navigateur). Comportement STRICTEMENT identique à aujourd'hui →
 *     c'est le chemin de ROLLBACK.
 *   • ApiDataClient — `fetch('/api/data/...')` (navigateur → notre API → Supabase).
 *     Livré dans des PR ultérieures ; ABSENT ici.
 *
 * Sélection par flag `NEXT_PUBLIC_DATA_LAYER` ('api' | 'direct', défaut 'direct').
 * Tant qu'ApiDataClient n'existe pas, on renvoie TOUJOURS le direct (garde-fou :
 * poser le flag 'api' trop tôt ne casse rien). Voir docs/phase0-data-api-design.md.
 */
import {
  loadTreesFromSupabase, saveTreeToSupabase, deleteTreeFromSupabase, deleteChildRows,
  loadOneTree, detectDeleteConflicts, restoreEntityAlive,
  type LoadResult, type DeleteConflict, type ChildTable,
} from '@/lib/supabaseSync';
import type { FamilyTree, Person, Relationship } from '@/types';

export interface DataClient {
  loadTrees(userId: string): Promise<LoadResult>;
  loadOneTree(treeId: string): Promise<FamilyTree | null>;
  saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean): Promise<void>;
  deleteTree(treeId: string, ownerId?: string): Promise<{ error?: string }>;
  deleteChildRows(table: ChildTable, ids: string[]): Promise<boolean>;
  detectDeleteConflicts(table: ChildTable, entities: { id: string; updatedAt?: string }[]): Promise<DeleteConflict[]>;
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship): Promise<void>;
}

/** Implémentation directe (actuelle) : pur passe-plat vers `supabaseSync`. */
class SupabaseDataClient implements DataClient {
  loadTrees(userId: string) { return loadTreesFromSupabase(userId); }
  loadOneTree(treeId: string) { return loadOneTree(treeId); }
  saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean) { return saveTreeToSupabase(tree, ownerId, isOwner); }
  deleteTree(treeId: string, ownerId?: string) { return deleteTreeFromSupabase(treeId, ownerId); }
  deleteChildRows(table: ChildTable, ids: string[]) { return deleteChildRows(table, ids); }
  detectDeleteConflicts(table: ChildTable, entities: { id: string; updatedAt?: string }[]) { return detectDeleteConflicts(table, entities); }
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship) { return restoreEntityAlive(treeId, entityType, entity); }
}

const supabaseDataClient = new SupabaseDataClient();

/** Implémentation API (PR3+) : la LECTURE passe par /api/data/* ; l'ÉCRITURE
 * délègue encore au direct (endpoints d'écriture = PR4). Ainsi `DATA_LAYER='api'`
 * permet un canary LECTURE seul, sans casser les écritures. */
async function apiJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${res.status} sur ${url}`);
  return res.json() as Promise<T>;
}

class ApiDataClient implements DataClient {
  private readonly direct = supabaseDataClient; // méthodes pas encore migrées (écriture → PR4)

  loadTrees(_userId: string) { return apiJson<LoadResult>('/api/data/trees'); }
  async loadOneTree(treeId: string) {
    const res = await fetch(`/api/data/trees/${encodeURIComponent(treeId)}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status} sur /api/data/trees/${treeId}`);
    return res.json() as Promise<FamilyTree>;
  }
  // ↓ ÉCRITURE : encore en direct (migrée en PR4).
  saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean) { return this.direct.saveTree(tree, ownerId, isOwner); }
  deleteTree(treeId: string, ownerId?: string) { return this.direct.deleteTree(treeId, ownerId); }
  deleteChildRows(table: ChildTable, ids: string[]) { return this.direct.deleteChildRows(table, ids); }
  detectDeleteConflicts(table: ChildTable, entities: { id: string; updatedAt?: string }[]) { return this.direct.detectDeleteConflicts(table, entities); }
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship) { return this.direct.restoreEntity(treeId, entityType, entity); }
}

/** 'api' | 'direct' — défaut 'direct' (rollback par défaut). */
export const DATA_LAYER: 'api' | 'direct' =
  process.env.NEXT_PUBLIC_DATA_LAYER === 'api' ? 'api' : 'direct';

/** Exposé pour les tests (contrat de l'ApiDataClient). Ne pas utiliser en app :
 * passer par getDataClient(). */
export const apiDataClient: DataClient = new ApiDataClient();

/** Frontière réseau UNIQUE. Le flag choisit le transport ; défaut 'direct'
 * (rollback). En 'api' : lecture via /api/data/*, écriture encore directe (PR4). */
export function getDataClient(): DataClient {
  return DATA_LAYER === 'api' ? apiDataClient : supabaseDataClient;
}
