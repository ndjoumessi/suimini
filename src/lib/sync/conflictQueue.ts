'use client';
import { useSyncExternalStore } from 'react';
import type { Person, Relationship } from '@/types';

/**
 * File d'attente légère des conflits multi-appareils (delete-vs-edit).
 *
 * ⚠️ Le web N'UTILISE PAS Zustand (réservé au mobile) : ce module est un petit store
 * maison — un tableau persisté dans localStorage `suimini_conflicts`, exposé à React
 * via `useSyncExternalStore` (subscribe/getSnapshot). La référence de `conflicts` ne
 * change QU'à la mutation → getSnapshot est stable (pas de boucle de rendu).
 *
 * Un conflit = « une personne / relation que J'édite localement a été supprimée
 * (soft-delete) sur un AUTRE appareil APRÈS ma dernière édition ». On l'enfile au
 * push (avant l'upsert) au lieu de ressusciter l'entité ; l'utilisateur tranche via
 * ConflictModal (garder la suppression / restaurer).
 */

const KEY = 'suimini_conflicts';

export type ConflictEntityType = 'person' | 'relationship';

export interface Conflict {
  /** id de l'entité — sert aussi de clé unique dans la file (un conflit par entité). */
  id: string;
  entityType: ConflictEntityType;
  treeId: string;
  local: Person | Relationship;
  /** deleted_at distant (ISO) au moment de la détection. */
  remoteDeletedAt: string;
  type: 'delete-vs-edit';
}

const EMPTY: Conflict[] = [];

function load(): Conflict[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Conflict[]) : [];
    return Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

let conflicts: Conflict[] = load();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(conflicts)); } catch { /* ignore */ }
}
function emit(): void {
  for (const l of listeners) l();
}

/** Snapshot courant (référence stable entre deux mutations). */
export function getConflicts(): Conflict[] {
  return conflicts;
}

/**
 * Enfile un lot de conflits. Dédupliqué par id : un id déjà présent est remplacé
 * seulement si le `remoteDeletedAt` change (nouvelle info), sinon ignoré — donc un
 * push répété sur le même conflit ne déclenche pas de re-rendu inutile.
 */
export function addConflicts(items: Conflict[]): void {
  if (!items || items.length === 0) return;
  const byId = new Map(conflicts.map(c => [c.id, c]));
  let changed = false;
  for (const it of items) {
    const existing = byId.get(it.id);
    if (!existing) { byId.set(it.id, it); changed = true; }
    else if (existing.remoteDeletedAt !== it.remoteDeletedAt || existing.local !== it.local) {
      byId.set(it.id, it); changed = true;
    }
  }
  if (!changed) return;
  conflicts = [...byId.values()];
  persist();
  emit();
}

/** Retire un conflit résolu. */
export function removeConflict(id: string): void {
  const next = conflicts.filter(c => c.id !== id);
  if (next.length === conflicts.length) return;
  conflicts = next;
  persist();
  emit();
}

/** Vide toute la file. */
export function clearConflicts(): void {
  if (conflicts.length === 0) return;
  conflicts = EMPTY;
  persist();
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot(): Conflict[] { return conflicts; }
function getServerSnapshot(): Conflict[] { return EMPTY; }

/** Hook React : la liste des conflits en attente (re-rend au changement). */
export function useConflicts(): Conflict[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
