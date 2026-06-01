'use client';
import { useState, useEffect, useCallback } from 'react';
import { FamilyTree, Person, Relationship } from '@/types';
import { sampleFamilyTree } from '@/lib/sampleData';
import { generateId, getDisplayName } from '@/lib/treeUtils';

const STORAGE_KEY = 'suimini_trees';
const ACTIVE_TREE_KEY = 'suimini_active_tree';
const MAX_HISTORY = 50;

interface HistorySnapshot {
  trees: FamilyTree[];
  description: string;
}

export function useFamilyStore() {
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Undo / redo stacks
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_TREE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored) as FamilyTree[];
      setTrees(parsed);
      setActiveTreeId(activeId || parsed[0]?.id || null);
    } else {
      // Load sample data
      setTrees([sampleFamilyTree]);
      setActiveTreeId(sampleFamilyTree.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleFamilyTree]));
      localStorage.setItem(ACTIVE_TREE_KEY, sampleFamilyTree.id);
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((updated: FamilyTree[]) => {
    setTrees(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
    if (activeTreeId === treeId) {
      const newActive = updated[0]?.id || null;
      setActiveTreeId(newActive);
      if (newActive) localStorage.setItem(ACTIVE_TREE_KEY, newActive);
    }
  }, [trees, persist, activeTreeId]);

  const switchTree = useCallback((treeId: string) => {
    setActiveTreeId(treeId);
    localStorage.setItem(ACTIVE_TREE_KEY, treeId);
  }, []);

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

  const deleteRelationship = useCallback((relId: string) => {
    if (!activeTree) return;
    const relationships = activeTree.relationships.filter(r => r.id !== relId);
    updateTreeWithHistory(
      { ...activeTree, relationships },
      `Suppression d'une relation`
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
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    deleteRelationship,
    importTree,
    // history
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    lastAction: past.length > 0 ? past[past.length - 1].description : null,
    nextAction: future.length > 0 ? future[future.length - 1].description : null,
  };
}
