'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FamilyTree, Person, Relationship, JournalEntry } from '@/types';
import { sampleFamilyTree } from '@/lib/sampleData';
import { generateId, getDisplayName } from '@/lib/treeUtils';
import { isSupabaseConfigured } from '@/lib/supabase';
import { loadTreesFromSupabase, saveTreeToSupabase, deleteTreeFromSupabase, loadOneTree, SharedMeta } from '@/lib/supabaseSync';
import { offlineStorage } from '@/lib/offlineStorage';

const STORAGE_KEY = 'suimini_trees';
const ACTIVE_TREE_KEY = 'suimini_active_tree';
const MAX_HISTORY = 50;

export type SyncStatus = 'idle' | 'saved' | 'syncing' | 'offline' | 'error';
export interface StoreUser { id: string; email?: string }

interface HistorySnapshot {
  trees: FamilyTree[];
  description: string;
}

export function useFamilyStore(user: StoreUser | null = null, authReady = true) {
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Undo / redo stacks
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  // Cloud sync state
  const cloud = !!user && isSupabaseConfigured;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [shared, setShared] = useState<Record<string, SharedMeta>>({});
  const [migrationPending, setMigrationPending] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localCacheRef = useRef<FamilyTree[]>([]);

  // Initial LOCAL load. Waits for auth to resolve (`authReady`) so we never flash
  // the demo sample to a logged-in user. We always read localStorage into
  // localCacheRef (for migration detection), but only SHOW local data — and only
  // ever seed the sample — for guests/demo. Logged-in (cloud) users are populated
  // exclusively by the cloud effect below, which flips `loaded` when done.
  useEffect(() => {
    if (!authReady || typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as FamilyTree[]) : [];
    localCacheRef.current = parsed;

    if (cloud) return; // logged-in: defer to the cloud effect; no sample.

    // Prefer IndexedDB (survives localStorage quota limits); fall back to localStorage.
    (async () => {
      try {
        const idbTrees = await offlineStorage.getAllTrees();
        if (idbTrees.length > 0) {
          // IndexedDB has data → use it directly.
          setTrees(idbTrees);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || idbTrees[0]?.id || null);
          localCacheRef.current = idbTrees;
        } else if (parsed.length > 0) {
          // Migrate localStorage → IndexedDB (one-time upgrade).
          for (const tree of parsed) await offlineStorage.setTree(tree);
          setTrees(parsed);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || parsed[0]?.id || null);
        } else {
          // Guest / demo, first visit → seed the sample tree.
          setTrees([sampleFamilyTree]);
          localCacheRef.current = [sampleFamilyTree];
          setActiveTreeId(sampleFamilyTree.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleFamilyTree]));
          localStorage.setItem(ACTIVE_TREE_KEY, sampleFamilyTree.id);
          await offlineStorage.setTree(sampleFamilyTree);
        }
      } catch {
        // IndexedDB unavailable (private browsing, etc.) → fall back to localStorage.
        if (parsed.length) {
          setTrees(parsed);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || parsed[0]?.id || null);
        } else {
          setTrees([sampleFamilyTree]);
          localCacheRef.current = [sampleFamilyTree];
          setActiveTreeId(sampleFamilyTree.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleFamilyTree]));
          localStorage.setItem(ACTIVE_TREE_KEY, sampleFamilyTree.id);
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, [authReady, cloud]);

  // On login: load cloud data (and offer migration of local data when the cloud is empty).
  // NOTE: callers must pass a STABLE `user` reference (memoized) — otherwise this
  // effect re-runs every render and `syncStatus` stays stuck on 'syncing'.
  useEffect(() => {
    if (!cloud || !user) { setSyncStatus('idle'); setShared({}); setMigrationPending(false); return; }
    let active = true;
    setSyncStatus('syncing');
    // Safety net: never leave the indicator stuck on "syncing" (slow/hung network).
    const safety = setTimeout(() => { if (active) setSyncStatus(s => (s === 'syncing' ? 'idle' : s)); }, 10000);
    // The sample tree ('tree1', Famille Dupont) is never genuine user data.
    const localTrees = localCacheRef.current;
    const onlySample = localTrees.length === 1 && localTrees[0].id === 'tree1';
    const hasRealLocal = localTrees.length > 0 && !onlySample;
    (async () => {
      try {
        const { trees: remote, shared: sharedMeta } = await loadTreesFromSupabase(user.id);
        if (!active) return;
        setShared(sharedMeta);
        if (remote.length > 0) {
          setMigrationPending(false);
          setTrees(remote);
          setActiveTreeId(prev => (remote.find(t => t.id === prev) ? prev : remote[0]?.id || null));
          setSyncStatus('saved');
        } else if (hasRealLocal) {
          // Cloud empty but genuine local data → show it + offer migration (never the sample).
          setMigrationPending(true);
          setTrees(localTrees);
          setActiveTreeId(localTrees[0]?.id || null);
          setSyncStatus('saved');
        } else {
          // Cloud empty, no real local data → empty state / onboarding (NOT the sample).
          // Nothing to sync → idle (no "Synchronisation…" forever for a 0-tree account).
          setMigrationPending(false);
          setTrees([]);
          setActiveTreeId(null);
          setSyncStatus('idle');
        }
      } catch {
        if (!active) return;
        // Failure: fall back to real local data if any, otherwise empty — never the sample.
        if (hasRealLocal) { setTrees(localTrees); setActiveTreeId(localTrees[0]?.id || null); }
        else { setTrees([]); setActiveTreeId(null); }
        setSyncStatus('error');
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; clearTimeout(safety); };
  }, [cloud, user]);

  // Debounced push of the active tree to the cloud after any change.
  // (declared after activeTree below)

  const persist = useCallback((updated: FamilyTree[]) => {
    setTrees(updated);
    localCacheRef.current = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Fire-and-forget IndexedDB write (resilient: silently ignored on failure).
    Promise.all(updated.map(t => offlineStorage.setTree(t))).catch(() => {});
  }, []);

  // Persist + record an undoable history snapshot of the PREVIOUS state.
  const commit = useCallback((updated: FamilyTree[], description: string) => {
    setPast(prev => {
      const snapshot: HistorySnapshot = { trees, description };
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
    persist(updated);
  }, [trees, persist]);

  const activeTree = trees.find(t => t.id === activeTreeId) || null;

  // Debounced cloud push of the active tree after any local change.
  const activeTreeKey = activeTree ? JSON.stringify(activeTree) : '';
  useEffect(() => {
    if (!cloud || !user || !activeTree || migrationPending) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSyncStatus('syncing');
      const isOwner = !shared[activeTree.id];
      saveTreeToSupabase(activeTree, user.id, isOwner)
        .then(() => setSyncStatus('saved'))
        .catch(() => setSyncStatus('error'));
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTreeKey, cloud]);

  // Reload one tree from the cloud (used by realtime collaborator updates).
  const reloadTreeFromCloud = useCallback(async (treeId: string) => {
    if (!cloud) return;
    const fresh = await loadOneTree(treeId);
    if (fresh) {
      setTrees(prev => prev.map(t => t.id === treeId ? fresh : t));
      localCacheRef.current = localCacheRef.current.map(t => t.id === treeId ? fresh : t);
    }
  }, [cloud]);

  // Migrate local trees to the cloud (on user confirmation).
  const runMigration = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      for (const t of localCacheRef.current) await saveTreeToSupabase(t, user.id, true);
      setMigrationPending(false);
      setSyncStatus('saved');
    } catch {
      setSyncStatus('offline');
    }
  }, [user]);

  const dismissMigration = useCallback(() => setMigrationPending(false), []);

  // updateTree is the primitive used by every editing action — it records history.
  const updateTreeWithHistory = useCallback((updatedTree: FamilyTree, description: string) => {
    const updated = trees.map(t => t.id === updatedTree.id ? { ...updatedTree, updatedAt: new Date().toISOString() } : t);
    commit(updated, description);
  }, [trees, commit]);

  // Public updateTree (non-history) kept for compatibility — also records history.
  const updateTree = useCallback((updatedTree: FamilyTree) => {
    updateTreeWithHistory(updatedTree, `Modification de l'arbre`);
  }, [updateTreeWithHistory]);

  const createTree = useCallback((name: string, description?: string) => {
    const newTree: FamilyTree = {
      id: generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      persons: [],
      relationships: [],
      settings: {
        defaultView: 'tree',
        showPhotos: true,
        showDates: true,
        showPlaces: true,
        colorScheme: 'default',
        generationsToShow: 5,
      },
    };
    const updated = [...trees, newTree];
    persist(updated);
    setActiveTreeId(newTree.id);
    localStorage.setItem(ACTIVE_TREE_KEY, newTree.id);
    return newTree;
  }, [trees, persist]);

  const deleteTree = useCallback((treeId: string) => {
    const updated = trees.filter(t => t.id !== treeId);
    persist(updated);
    // Prune the offline cache too. `persist` only UPSERTS the remaining trees into
    // IndexedDB, so without this the deleted tree survives in IDB and the local-load
    // effect (which reads IDB first) resurrects it on the next visit — the root cause
    // of "impossible de supprimer un arbre".
    offlineStorage.deleteTree(treeId).catch(() => {});
    if (cloud && user) deleteTreeFromSupabase(treeId, user.id).catch(() => {});
    if (activeTreeId === treeId) {
      const newActive = updated[0]?.id || null;
      setActiveTreeId(newActive);
      if (newActive) localStorage.setItem(ACTIVE_TREE_KEY, newActive);
      else localStorage.removeItem(ACTIVE_TREE_KEY);
    }
  }, [trees, persist, activeTreeId, cloud, user]);

  const switchTree = useCallback((treeId: string) => {
    setActiveTreeId(treeId);
    localStorage.setItem(ACTIVE_TREE_KEY, treeId);
  }, []);

  // Rename / edit description of any tree (undoable).
  const updateTreeMeta = useCallback((treeId: string, meta: { name?: string; description?: string }) => {
    const target = trees.find(t => t.id === treeId);
    if (!target) return;
    updateTreeWithHistory(
      { ...target, name: meta.name ?? target.name, description: meta.description ?? target.description },
      `Modification de l'arbre « ${meta.name ?? target.name} »`
    );
  }, [trees, updateTreeWithHistory]);

  // Deep-clone a tree under a new name (becomes active).
  const duplicateTree = useCallback((treeId: string, newName: string) => {
    const src = trees.find(t => t.id === treeId);
    if (!src) return null;
    const now = new Date().toISOString();
    const copy: FamilyTree = {
      ...JSON.parse(JSON.stringify(src)),
      id: generateId(),
      name: newName,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...trees, copy];
    persist(updated);
    setActiveTreeId(copy.id);
    localStorage.setItem(ACTIVE_TREE_KEY, copy.id);
    return copy;
  }, [trees, persist]);

  // Person CRUD
  const addPerson = useCallback((person: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!activeTree) return null;
    const newPerson: Person = {
      ...person,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateTreeWithHistory(
      { ...activeTree, persons: [...activeTree.persons, newPerson] },
      `Ajout de ${newPerson.firstName} ${newPerson.lastName}`
    );
    return newPerson;
  }, [activeTree, updateTreeWithHistory]);

  const updatePerson = useCallback((personId: string, updates: Partial<Person>) => {
    if (!activeTree) return;
    const target = activeTree.persons.find(p => p.id === personId);
    const persons = activeTree.persons.map(p =>
      p.id === personId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    updateTreeWithHistory(
      { ...activeTree, persons },
      `Modification de ${target ? getDisplayName(target) : 'la personne'}`
    );
  }, [activeTree, updateTreeWithHistory]);

  const deletePerson = useCallback((personId: string) => {
    if (!activeTree) return;
    const target = activeTree.persons.find(p => p.id === personId);
    const persons = activeTree.persons.filter(p => p.id !== personId);
    const relationships = activeTree.relationships.filter(
      r => r.person1Id !== personId && r.person2Id !== personId
    );
    updateTreeWithHistory(
      { ...activeTree, persons, relationships },
      `Suppression de ${target ? getDisplayName(target) : 'la personne'}`
    );
  }, [activeTree, updateTreeWithHistory]);

  // Relationship CRUD
  const addRelationship = useCallback((rel: Omit<Relationship, 'id'>) => {
    if (!activeTree) return null;
    const newRel: Relationship = { ...rel, id: generateId() };
    updateTreeWithHistory(
      { ...activeTree, relationships: [...activeTree.relationships, newRel] },
      `Ajout d'une relation`
    );
    return newRel;
  }, [activeTree, updateTreeWithHistory]);

  const updateRelationship = useCallback((relId: string, updates: Partial<Relationship>) => {
    if (!activeTree) return;
    const relationships = activeTree.relationships.map(r =>
      r.id === relId ? { ...r, ...updates } : r
    );
    updateTreeWithHistory({ ...activeTree, relationships }, `Modification d'une relation`);
  }, [activeTree, updateTreeWithHistory]);

  const deleteRelationship = useCallback((relId: string) => {
    if (!activeTree) return;
    const relationships = activeTree.relationships.filter(r => r.id !== relId);
    updateTreeWithHistory(
      { ...activeTree, relationships },
      `Suppression d'une relation`
    );
  }, [activeTree, updateTreeWithHistory]);

  // Journal CRUD
  const addJournalEntry = useCallback((entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!activeTree) return null;
    const now = new Date().toISOString();
    const newEntry: JournalEntry = { ...entry, id: generateId(), createdAt: now, updatedAt: now };
    updateTreeWithHistory(
      { ...activeTree, journal: [...(activeTree.journal || []), newEntry] },
      `Ajout d'une entrée de journal`
    );
    return newEntry;
  }, [activeTree, updateTreeWithHistory]);

  const updateJournalEntry = useCallback((id: string, updates: Partial<JournalEntry>) => {
    if (!activeTree) return;
    const journal = (activeTree.journal || []).map(e =>
      e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
    );
    updateTreeWithHistory({ ...activeTree, journal }, `Modification d'une entrée de journal`);
  }, [activeTree, updateTreeWithHistory]);

  const deleteJournalEntry = useCallback((id: string) => {
    if (!activeTree) return;
    updateTreeWithHistory(
      { ...activeTree, journal: (activeTree.journal || []).filter(e => e.id !== id) },
      `Suppression d'une entrée de journal`
    );
  }, [activeTree, updateTreeWithHistory]);

  const importTree = useCallback((tree: FamilyTree) => {
    const imported = { ...tree, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = [...trees, imported];
    persist(updated);
    setActiveTreeId(imported.id);
    localStorage.setItem(ACTIVE_TREE_KEY, imported.id);
  }, [trees, persist]);

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    setPast(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setFuture(f => [...f, { trees, description: snapshot.description }]);
      persist(snapshot.trees);
      return prev.slice(0, -1);
    });
  }, [trees, persist]);

  const redo = useCallback(() => {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setPast(p => [...p, { trees, description: snapshot.description }]);
      persist(snapshot.trees);
      return prev.slice(0, -1);
    });
  }, [trees, persist]);

  return {
    trees,
    activeTree,
    activeTreeId,
    loaded,
    createTree,
    deleteTree,
    switchTree,
    updateTree,
    updateTreeMeta,
    duplicateTree,
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    updateRelationship,
    deleteRelationship,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    importTree,
    // history
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    lastAction: past.length > 0 ? past[past.length - 1].description : null,
    nextAction: future.length > 0 ? future[future.length - 1].description : null,
    // cloud sync
    cloud,
    syncStatus,
    shared,
    migrationPending,
    runMigration,
    dismissMigration,
    reloadTreeFromCloud,
  };
}
