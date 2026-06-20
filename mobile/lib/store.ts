/**
 * Family-tree store (Zustand + MMKV). Source of truth on device.
 * Always seeds the demo tree ("Famille Dupont", tree1) so the app is usable
 * offline / signed-out — same contract as the web useFamilyStore.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FamilyTree, Person, Relationship } from './types';
import { sampleFamilyTree } from './sampleData';
import { loadTreesFromSupabase } from './supabaseSync';
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
  upsertPerson: (treeId: string, person: Person) => void;
  removePerson: (treeId: string, personId: string) => void;
}

function mergeTrees(local: FamilyTree[], remote: FamilyTree[]): FamilyTree[] {
  const byId = new Map<string, FamilyTree>();
  local.forEach((t) => byId.set(t.id, t));
  remote.forEach((t) => byId.set(t.id, t)); // remote wins
  return Array.from(byId.values());
}

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
        set({ syncStatus: 'syncing' });
        try {
          const remote = await loadTreesFromSupabase();
          if (remote.length === 0) {
            set({ syncStatus: 'offline' });
            return;
          }
          const merged = mergeTrees(get().trees, remote);
          set({
            trees: merged,
            activeTreeId: get().activeTreeId ?? remote[0].id,
            syncStatus: 'saved',
          });
        } catch {
          set({ syncStatus: 'error' });
        }
      },

      upsertPerson: (treeId, person) =>
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
        })),

      removePerson: (treeId, personId) =>
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
        })),
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
