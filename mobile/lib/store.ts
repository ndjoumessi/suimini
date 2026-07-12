/**
 * Family-tree store (Zustand + MMKV). Source of truth on device.
 * Always seeds the demo tree ("Famille Dupont", tree1) so the app is usable
 * offline / signed-out — same contract as the web useFamilyStore.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FamilyTree, Person, Relationship } from './types';
import { sampleFamilyTree } from './sampleData';
import {
  loadTreesFromSupabase,
  upsertPersonRemote,
  deletePersonRemote,
  upsertRelationshipRemote,
  deleteRelationshipRemote,
} from './supabaseSync';
import { isSupabaseConfigured } from './supabase';
import { createKVStorage } from './storage';

const mmkv = createKVStorage('suimini-store');

const zustandMmkvStorage = {
  getItem: (name: string) => mmkv.getString(name) ?? null,
  setItem: (name: string, value: string) => mmkv.set(name, value),
  removeItem: (name: string) => mmkv.delete(name),
};

export type SyncStatus = 'idle' | 'saved' | 'syncing' | 'offline' | 'error';

interface FamilyState {
  trees: FamilyTree[];
  activeTreeId: string | null;
  syncStatus: SyncStatus;
  hydrated: boolean;
  /**
   * Demo session flag. Lives in the store (not in useAuth's local state) so it
   * is shared across every component — notably the AuthGate in _layout.tsx,
   * which would otherwise never see a demo started from the login screen.
   */
  isDemo: boolean;

  /** Ensure the demo tree exists; pick an active tree if none selected. */
  seedDemo: () => void;
  /** Enter demo mode: seed the sample tree and flip the demo flag (no Supabase). */
  startDemo: () => void;
  /** Leave demo mode (e.g. on real sign-in / sign-out). */
  exitDemo: () => void;
  setActiveTree: (id: string) => void;
  /** Pull trees from Supabase (no-op without a configured client). */
  refreshFromRemote: () => Promise<void>;
  /** Insert/update a person: optimistic local write + Supabase (skipped in demo). */
  upsertPerson: (treeId: string, person: Person) => Promise<WriteOutcome>;
  /** Delete a person: optimistic local write + Supabase (skipped in demo). */
  removePerson: (treeId: string, personId: string) => Promise<WriteOutcome>;
  /** Insert/update a relationship: optimistic local write + Supabase (skipped in demo). */
  addRelationship: (treeId: string, rel: Relationship) => Promise<WriteOutcome>;
  /** Delete a relationship: optimistic local write + Supabase (skipped in demo). */
  removeRelationship: (treeId: string, relId: string) => Promise<WriteOutcome>;
}

export interface WriteOutcome { ok: boolean; error?: string }

export const useStore = create<FamilyState>()(
  persist(
    (set, get) => ({
      trees: [],
      activeTreeId: null,
      syncStatus: 'idle',
      hydrated: false,
      isDemo: false,

      seedDemo: () => {
        const { trees, activeTreeId } = get();
        const hasDemo = trees.some((t) => t.id === sampleFamilyTree.id);
        const next = hasDemo ? trees : [sampleFamilyTree, ...trees];
        set({
          trees: next,
          activeTreeId: activeTreeId ?? next[0]?.id ?? sampleFamilyTree.id,
        });
      },

      startDemo: () => {
        get().seedDemo();
        set({ isDemo: true, syncStatus: 'offline' });
      },

      exitDemo: () => set({ isDemo: false }),

      setActiveTree: (id) => set({ activeTreeId: id }),

      refreshFromRemote: async () => {
        // Demo / unconfigured → purely local, no network.
        if (get().isDemo || !isSupabaseConfigured) {
          set({ syncStatus: 'offline' });
          return;
        }
        set({ syncStatus: 'syncing' });
        try {
          const remote = await loadTreesFromSupabase();
          // Connected user: REPLACE the store with their own trees (the demo
          // seed must not bleed in). Keep the active tree if it still exists.
          const current = get().activeTreeId;
          const keepActive = remote.some((t) => t.id === current);
          set({
            trees: remote,
            activeTreeId: keepActive ? current : (remote[0]?.id ?? null),
            isDemo: false,
            syncStatus: 'saved',
          });
        } catch {
          // Fetch failed → keep whatever is local, mark offline.
          set({ syncStatus: 'offline' });
        }
      },

      upsertPerson: async (treeId, person) => {
        // Optimistic local write first (instant UI, works offline / demo).
        set((s) => ({
          trees: s.trees.map((t) => {
            if (t.id !== treeId) return t;
            const exists = t.persons.some((p) => p.id === person.id);
            return {
              ...t,
              persons: exists
                ? t.persons.map((p) => (p.id === person.id ? person : p))
                : [...t.persons, person],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        if (get().isDemo) return { ok: true };
        set({ syncStatus: 'syncing' });
        // Post-update tree carries the metadata (name/settings/…) the remote
        // save needs to keep the `trees` row write idempotent — see
        // upsertPersonRemote in supabaseSync.ts.
        const tree = get().trees.find((t) => t.id === treeId);
        if (!tree) {
          set({ syncStatus: 'error' });
          return { ok: false, error: 'Arbre introuvable' };
        }
        const { error } = await upsertPersonRemote(tree, person);
        set({ syncStatus: error ? 'error' : 'saved' });
        return error ? { ok: false, error } : { ok: true };
      },

      removePerson: async (treeId, personId) => {
        // Capture the relationships this person is part of BEFORE the local
        // filter drops them — the remote soft-delete needs their ids.
        const before = get().trees.find((t) => t.id === treeId);
        const affectedRelationshipIds = before
          ? before.relationships
              .filter((r) => r.person1Id === personId || r.person2Id === personId)
              .map((r) => r.id)
          : [];
        set((s) => ({
          trees: s.trees.map((t) =>
            t.id === treeId
              ? {
                  ...t,
                  persons: t.persons.filter((p) => p.id !== personId),
                  relationships: t.relationships.filter(
                    (r: Relationship) =>
                      r.person1Id !== personId && r.person2Id !== personId,
                  ),
                }
              : t,
          ),
        }));
        if (get().isDemo) return { ok: true };
        set({ syncStatus: 'syncing' });
        const { error } = await deletePersonRemote(treeId, personId, affectedRelationshipIds);
        set({ syncStatus: error ? 'error' : 'saved' });
        return error ? { ok: false, error } : { ok: true };
      },

      addRelationship: async (treeId, rel) => {
        // Optimistic local write first (instant UI, works offline / demo).
        set((s) => ({
          trees: s.trees.map((t) => {
            if (t.id !== treeId) return t;
            const exists = t.relationships.some((r) => r.id === rel.id);
            return {
              ...t,
              relationships: exists
                ? t.relationships.map((r) => (r.id === rel.id ? rel : r))
                : [...t.relationships, rel],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        if (get().isDemo) return { ok: true };
        set({ syncStatus: 'syncing' });
        const tree = get().trees.find((t) => t.id === treeId);
        if (!tree) {
          set({ syncStatus: 'error' });
          return { ok: false, error: 'Arbre introuvable' };
        }
        const { error } = await upsertRelationshipRemote(tree, rel);
        set({ syncStatus: error ? 'error' : 'saved' });
        return error ? { ok: false, error } : { ok: true };
      },

      removeRelationship: async (treeId, relId) => {
        set((s) => ({
          trees: s.trees.map((t) =>
            t.id === treeId
              ? {
                  ...t,
                  relationships: t.relationships.filter((r) => r.id !== relId),
                  updatedAt: new Date().toISOString(),
                }
              : t,
          ),
        }));
        if (get().isDemo) return { ok: true };
        set({ syncStatus: 'syncing' });
        const { error } = await deleteRelationshipRemote(treeId, relId);
        set({ syncStatus: error ? 'error' : 'saved' });
        return error ? { ok: false, error } : { ok: true };
      },
    }),
    {
      name: 'suimini-family',
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (s) => ({ trees: s.trees, activeTreeId: s.activeTreeId }),
      onRehydrateStorage: () => (state) => {
        state?.seedDemo();
        useStore.setState({ hydrated: true });
      },
    },
  ),
);
