'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FamilyTree, Person, Relationship, JournalEntry } from '@/types';
import { sampleFamilyTree } from '@/lib/sampleData';
import { generateId, getDisplayName } from '@/lib/treeUtils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { loadTreesFromSupabase, saveTreeToSupabase, deleteTreeFromSupabase, loadOneTree, SharedMeta } from '@/lib/supabaseSync';
import { offlineStorage } from '@/lib/offlineStorage';

const STORAGE_KEY = 'suimini_trees';
const ACTIVE_TREE_KEY = 'suimini_active_tree';
const MAX_HISTORY = 50;
// The local→cloud migration prompt is a one-time decision per browser. Once the
// user imports OR dismisses it, we persist that so it never re-appears on the
// next login (the local data is still on disk and would otherwise re-trigger it).
const IMPORT_DONE_KEY = 'suimini_import_done';
const IMPORT_DISMISSED_KEY = 'suimini_import_dismissed';

/** True when the user already imported or dismissed the local-data migration prompt. */
function importPromptSuppressed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(IMPORT_DONE_KEY) === 'true'
      || localStorage.getItem(IMPORT_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

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
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localCacheRef = useRef<FamilyTree[]>([]);
  // Timestamp of the last cloud push made by THIS client. Realtime echoes our own
  // writes back; the app uses this to ignore them (see SuiminiApp) so we don't
  // toast "un collaborateur a modifié" in a loop on our own edits.
  const lastLocalWriteRef = useRef(0);
  // Set true the moment a cloud load begins. The guest/IndexedDB branch checks it
  // and bails, so a stale local read (started while auth was still resolving) can
  // NEVER overwrite the Supabase data. This is the definitive race guard.
  const supabaseLoadedRef = useRef(false);

  // SINGLE load effect. Gated on authReady so it never runs against a half-init
  // client. It branches by mode — and the two branches are mutually exclusive:
  //   • cloud (logged in)  → load from Supabase ONLY. IndexedDB is NEVER read at
  //     startup in cloud mode. `supabaseLoadedRef` is flipped true synchronously,
  //     so any in-flight guest read bails instead of clobbering the cloud data.
  //   • guest / demo       → load from IndexedDB / localStorage (seed the sample).
  useEffect(() => {
    if (!authReady || typeof window === 'undefined') return;

    // Always cache localStorage into localCacheRef (migration detection), cheaply.
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as FamilyTree[]) : [];
    localCacheRef.current = parsed;

    // ===== CLOUD MODE: Supabase is the only source. IndexedDB is never read. =====
    if (cloud && user) {
      supabaseLoadedRef.current = true; // from now on the guest branch must not write
      let active = true;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      setSyncStatus('syncing');
      // Safety net: never leave the indicator stuck on "syncing" (slow/hung network).
      const safety = setTimeout(() => { if (active) setSyncStatus(s => (s === 'syncing' ? 'idle' : s)); }, 10000);
      const localTrees = localCacheRef.current;
      const onlySample = localTrees.length === 1 && localTrees[0].id === 'tree1';
      const hasRealLocal = localTrees.length > 0 && !onlySample;

      // On a cold load the access token may not be attached to the FIRST REST call
      // yet → RLS returns [] and the app looked empty until a manual refresh. Retry a
      // few times before concluding the account is empty. The loading screen stays up
      // across retries (we don't flip `loaded`), so there is no empty flash.
      const MAX_ATTEMPTS = 3;
      const run = async (attempt: number) => {
        try {
          const { trees: remote, shared: sharedMeta } = await loadTreesFromSupabase(user.id);
          if (!active) return;
          setShared(sharedMeta);
          if (remote.length > 0) {
            setMigrationPending(false);
            setTrees(remote);
            setActiveTreeId(prev => (remote.find(t => t.id === prev) ? prev : remote[0]?.id || null));
            setSyncStatus('saved');
            setLastSyncAt(Date.now());
            // HARD REFRESH of the local cache: Supabase is the source of truth, so we
            // REPLACE IndexedDB (clear + rewrite) rather than merge — this is what makes
            // SQL-side changes appear on next login without manually wiping storage.
            localCacheRef.current = remote;
            try {
              await offlineStorage.clear();
              if (!active) return;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
              for (const t of remote) await offlineStorage.setTree(t);
            } catch { /* IndexedDB/localStorage unavailable — non-fatal */ }
            if (active) setLoaded(true);
            return;
          }
          if (hasRealLocal) {
            // Cloud empty but genuine local data → show it + offer migration (never the
            // sample), UNLESS already imported/dismissed on this browser.
            setMigrationPending(!importPromptSuppressed());
            setTrees(localTrees);
            setActiveTreeId(localTrees[0]?.id || null);
            setSyncStatus('saved');
            if (active) setLoaded(true);
            return;
          }
          // Empty + no local data: could be a token-not-ready race → retry, else onboard.
          if (attempt < MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => { if (active) run(attempt + 1); }, 400 * attempt);
            return; // keep the loading screen up; do NOT flip `loaded` yet
          }
          setMigrationPending(false);
          setTrees([]);
          setActiveTreeId(null);
          setSyncStatus('idle');
          if (active) setLoaded(true);
        } catch (err) {
          if (!active) return;
          if (attempt < MAX_ATTEMPTS) {
            retryTimer = setTimeout(() => { if (active) run(attempt + 1); }, 400 * attempt);
            return;
          }
          console.error('[store] Chargement cloud échoué après retries:', err);
          // Fall back to real local data if any, otherwise empty — never the sample.
          if (hasRealLocal) { setTrees(localTrees); setActiveTreeId(localTrees[0]?.id || null); }
          else { setTrees([]); setActiveTreeId(null); }
          setSyncStatus('error');
          if (active) setLoaded(true);
        }
      };
      run(1);
      return () => { active = false; clearTimeout(safety); if (retryTimer) clearTimeout(retryTimer); };
    }

    // ===== GUEST / DEMO MODE: IndexedDB / localStorage / sample seed. =====
    setSyncStatus('idle'); setShared({}); setMigrationPending(false);
    // If a cloud load already owns the data (auth resolved after this branch was
    // queued), never read IndexedDB — that would resurrect stale/empty local data.
    if (supabaseLoadedRef.current) return;
    let active = true;
    (async () => {
      try {
        const idbTrees = await offlineStorage.getAllTrees();
        if (!active || supabaseLoadedRef.current) return;
        if (idbTrees.length > 0) {
          setTrees(idbTrees);
          setActiveTreeId(localStorage.getItem(ACTIVE_TREE_KEY) || idbTrees[0]?.id || null);
          localCacheRef.current = idbTrees;
        } else if (parsed.length > 0) {
          // Migrate localStorage → IndexedDB (one-time upgrade).
          for (const tree of parsed) await offlineStorage.setTree(tree);
          if (!active || supabaseLoadedRef.current) return;
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
        if (!active || supabaseLoadedRef.current) return;
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
        if (active && !supabaseLoadedRef.current) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, [authReady, cloud, user]);

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
      // Mark before AND after the write: the realtime echo of our own push can
      // arrive either side of the REST response, so we bracket the whole window.
      lastLocalWriteRef.current = Date.now();
      const isOwner = !shared[activeTree.id];
      saveTreeToSupabase(activeTree, user.id, isOwner)
        .then(() => { lastLocalWriteRef.current = Date.now(); setSyncStatus('saved'); })
        .catch((err) => { console.error('[store] Sauvegarde cloud échouée:', err?.message ?? err); setSyncStatus('error'); });
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

  // Force a full resync: wipe the local cache (localStorage + IndexedDB) and reload
  // everything from Supabase. Lets the user pull SQL-side changes on demand without
  // manually clearing storage. Returns true on success.
  const resync = useCallback(async (): Promise<boolean> => {
    if (!cloud || !user) return false;
    setSyncStatus('syncing');
    // Validate/refresh the session ONCE up-front (lock-serialised) so the data
    // queries below reuse a fresh access token instead of each triggering its own
    // refresh. On a stale token that contention can end in a failed refresh and a
    // spurious SIGNED_OUT — the "Se connecter réapparaît après resync" symptom. If
    // the session is genuinely gone, abort cleanly instead of firing a storm of
    // authenticated calls. (resync NEVER touches auth: it only clears the trees
    // cache — localStorage 'suimini_trees' + the IndexedDB 'trees' store — never the
    // Supabase session, which lives in cookies.)
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSyncStatus('error'); return false; }
    }
    try {
      const { trees: remote, shared: sharedMeta } = await loadTreesFromSupabase(user.id);
      try {
        await offlineStorage.clear();              // IndexedDB 'trees' store only
        localStorage.removeItem(STORAGE_KEY);      // 'suimini_trees' only — never the auth cookie
        for (const t of remote) await offlineStorage.setTree(t);
        if (remote.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      } catch { /* cache unavailable — non-fatal */ }
      localCacheRef.current = remote;
      setShared(sharedMeta);
      setTrees(remote);
      setActiveTreeId(prev => (remote.find(t => t.id === prev) ? prev : remote[0]?.id || null));
      setMigrationPending(false);
      setLastSyncAt(Date.now());
      setSyncStatus('saved');
      return true;
    } catch (err) {
      console.error('[store] Resync échouée:', err);
      setSyncStatus('error');
      return false;
    }
  }, [cloud, user]);

  // Migrate local trees to the cloud (on user confirmation).
  const runMigration = useCallback(async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      for (const t of localCacheRef.current) await saveTreeToSupabase(t, user.id, true);
      setMigrationPending(false);
      try { localStorage.setItem(IMPORT_DONE_KEY, 'true'); } catch { /* ignore */ }
      setSyncStatus('saved');
    } catch {
      setSyncStatus('offline');
    }
  }, [user]);

  const dismissMigration = useCallback(() => {
    setMigrationPending(false);
    try { localStorage.setItem(IMPORT_DISMISSED_KEY, 'true'); } catch { /* ignore */ }
  }, []);

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
    if (cloud && user) {
      deleteTreeFromSupabase(treeId, user.id)
        .then(({ error }) => { if (error) console.error('[store] Suppression cloud échouée:', error); })
        .catch((err) => console.error('[store] Suppression cloud échouée:', err?.message ?? err));
    }
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
    lastLocalWriteRef,
    resync,
    lastSyncAt,
  };
}
