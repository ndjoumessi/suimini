/**
 * Phase 0 — frontière RÉSEAU unique de la couche données.
 *
 * Tout le store (`useFamilyStore`) parle à un `DataClient`, plus jamais à Supabase
 * en direct. Deux implémentations :
 *   • SupabaseDataClient — délègue aux fonctions `supabaseSync` (client navigateur).
 *     Comportement identique à l'origine → chemin de ROLLBACK.
 *   • ApiDataClient — navigateur → /api/data/* → Supabase (lecture ET écriture).
 *
 * Sélection par flag `NEXT_PUBLIC_DATA_LAYER` ('api' | 'direct', défaut 'direct').
 * Voir docs/phase0-data-api-design.md.
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
  // treeId porté explicitement (vs supabaseSync qui ne le prend pas) → l'endpoint
  // peut faire une AuthZ canWriteTreeContent(treeId), pas seulement s'appuyer sur RLS.
  deleteChildRows(treeId: string, table: ChildTable, ids: string[]): Promise<boolean>;
  detectDeleteConflicts(treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[]): Promise<DeleteConflict[]>;
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship): Promise<void>;
}

/** Implémentation directe (actuelle) : pur passe-plat vers `supabaseSync`.
 * `treeId` est reçu pour l'interface mais ignoré (les fonctions supabaseSync ne le
 * prennent pas ; RLS scope déjà par ligne). */
class SupabaseDataClient implements DataClient {
  loadTrees(userId: string) { return loadTreesFromSupabase(userId); }
  loadOneTree(treeId: string) { return loadOneTree(treeId); }
  saveTree(tree: FamilyTree, ownerId: string, isOwner: boolean) { return saveTreeToSupabase(tree, ownerId, isOwner); }
  deleteTree(treeId: string, ownerId?: string) { return deleteTreeFromSupabase(treeId, ownerId); }
  deleteChildRows(_treeId: string, table: ChildTable, ids: string[]) { return deleteChildRows(table, ids); }
  detectDeleteConflicts(_treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[]) { return detectDeleteConflicts(table, entities); }
  restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship) { return restoreEntityAlive(treeId, entityType, entity); }
}

const supabaseDataClient = new SupabaseDataClient();

// ── Helpers HTTP (navigateur → /api/data/*) ──────────────────────────────────
async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${res.status} sur ${url}`);
  return res.json() as Promise<T>;
}
async function apiSend<T>(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method, credentials: 'same-origin',
    headers: { accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status} sur ${url}`);
  return res.json() as Promise<T>;
}

/** Implémentation API : lecture ET écriture via /api/data/* (PR3 lecture, PR4 écriture). */
class ApiDataClient implements DataClient {
  loadTrees(_userId: string) { return apiGet<LoadResult>('/api/data/trees'); }
  async loadOneTree(treeId: string) {
    const res = await fetch(`/api/data/trees/${encodeURIComponent(treeId)}`, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status} sur /api/data/trees/${treeId}`);
    return res.json() as Promise<FamilyTree>;
  }
  async saveTree(tree: FamilyTree, _ownerId: string, isOwner: boolean) {
    await apiSend(`/api/data/trees/${encodeURIComponent(tree.id)}/save`, 'POST', { tree, isOwner });
  }
  deleteTree(treeId: string) {
    return apiSend<{ error?: string }>(`/api/data/trees/${encodeURIComponent(treeId)}`, 'DELETE');
  }
  async deleteChildRows(treeId: string, table: ChildTable, ids: string[]) {
    const r = await apiSend<{ ok: boolean }>(`/api/data/trees/${encodeURIComponent(treeId)}/children/delete`, 'POST', { table, ids });
    return r.ok;
  }
  detectDeleteConflicts(treeId: string, table: ChildTable, entities: { id: string; updatedAt?: string }[]) {
    return apiSend<DeleteConflict[]>(`/api/data/trees/${encodeURIComponent(treeId)}/conflicts`, 'POST', { table, entities });
  }
  async restoreEntity(treeId: string, entityType: 'person' | 'relationship', entity: Person | Relationship) {
    await apiSend(`/api/data/trees/${encodeURIComponent(treeId)}/restore`, 'POST', { entityType, entity });
  }
}

/**
 * Sélecteur RUNTIME du transport (⚠️ PLUS de NEXT_PUBLIC inliné au build — c'était
 * la cause de l'échec du flip : une var build-time posée après coup ne change pas
 * un bundle déjà compilé). Priorité : cookie `suimini_data_layer` = 'api'|'direct'
 * → défaut 'direct'. Lu à CHAQUE appel → poser le cookie bascule la SESSION EN
 * COURS sans reload ni redeploy (canary par session ; rollback = effacer le cookie).
 * (Un défaut serveur runtime, exposé server→client, s'ajoutera pour le flip global.)
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null; // SSR / Node (tests)
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp('(?:^|; )' + esc + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getDataLayer(): 'api' | 'direct' {
  return readCookie('suimini_data_layer') === 'api' ? 'api' : 'direct';
}

/** Exposé pour les tests. En app, passer par getDataClient(). */
export const apiDataClient: DataClient = new ApiDataClient();

/** Frontière réseau UNIQUE. Transport choisi au RUNTIME (getDataLayer), défaut 'direct'. */
export function getDataClient(): DataClient {
  return getDataLayer() === 'api' ? apiDataClient : supabaseDataClient;
}

// Sonde d'observabilité (canary) : `window.__suiminiDataLayer()` renvoie le
// transport RÉELLEMENT actif dans CE bundle. Si la fonction n'existe pas → le
// navigateur sert encore l'ancien code (vider le SW / hard refresh).
if (typeof window !== 'undefined') {
  (window as unknown as { __suiminiDataLayer?: () => string }).__suiminiDataLayer = getDataLayer;
}
