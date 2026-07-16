import { get, set, del, values, clear, createStore } from 'idb-keyval';
import type { FamilyTree } from '@/types';

const store = createStore('suimini-db', 'trees');

export const offlineStorage = {
  async getTree(id: string): Promise<FamilyTree | null> {
    try {
      const tree = await get<FamilyTree>(id, store);
      return tree ?? null;
    } catch {
      return null;
    }
  },

  async setTree(tree: FamilyTree): Promise<void> {
    try {
      await set(tree.id, tree, store);
    } catch {
      // Silently ignore — IndexedDB might be unavailable (private browsing, quota exceeded…)
    }
  },

  async getAllTrees(): Promise<FamilyTree[]> {
    try {
      const all = await values<FamilyTree>(store);
      return all.filter(Boolean);
    } catch {
      return [];
    }
  },

  async deleteTree(id: string): Promise<void> {
    try {
      await del(id, store);
    } catch {
      // Silently ignore
    }
  },

  async clear(): Promise<void> {
    try {
      await clear(store);
    } catch {
      // Silently ignore
    }
  },
};
