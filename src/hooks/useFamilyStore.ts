'use client';
import { useState, useEffect, useCallback } from 'react';
import { FamilyTree, Person, Relationship } from '@/types';
import { sampleFamilyTree } from '@/lib/sampleData';
import { generateId } from '@/lib/treeUtils';

const STORAGE_KEY = 'suimini_trees';
const ACTIVE_TREE_KEY = 'suimini_active_tree';

export function useFamilyStore() {
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const save = useCallback((updated: FamilyTree[]) => {
    setTrees(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const activeTree = trees.find(t => t.id === activeTreeId) || null;

  const updateTree = useCallback((updatedTree: FamilyTree) => {
    const updated = trees.map(t => t.id === updatedTree.id ? { ...updatedTree, updatedAt: new Date().toISOString() } : t);
    save(updated);
  }, [trees, save]);

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
    save(updated);
    setActiveTreeId(newTree.id);
    localStorage.setItem(ACTIVE_TREE_KEY, newTree.id);
    return newTree;
  }, [trees, save]);

  const deleteTree = useCallback((treeId: string) => {
    const updated = trees.filter(t => t.id !== treeId);
    save(updated);
    if (activeTreeId === treeId) {
      const newActive = updated[0]?.id || null;
      setActiveTreeId(newActive);
      if (newActive) localStorage.setItem(ACTIVE_TREE_KEY, newActive);
    }
  }, [trees, save, activeTreeId]);

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
    updateTree({ ...activeTree, persons: [...activeTree.persons, newPerson] });
    return newPerson;
  }, [activeTree, updateTree]);

  const updatePerson = useCallback((personId: string, updates: Partial<Person>) => {
    if (!activeTree) return;
    const persons = activeTree.persons.map(p =>
      p.id === personId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    updateTree({ ...activeTree, persons });
  }, [activeTree, updateTree]);

  const deletePerson = useCallback((personId: string) => {
    if (!activeTree) return;
    const persons = activeTree.persons.filter(p => p.id !== personId);
    const relationships = activeTree.relationships.filter(
      r => r.person1Id !== personId && r.person2Id !== personId
    );
    updateTree({ ...activeTree, persons, relationships });
  }, [activeTree, updateTree]);

  // Relationship CRUD
  const addRelationship = useCallback((rel: Omit<Relationship, 'id'>) => {
    if (!activeTree) return null;
    const newRel: Relationship = { ...rel, id: generateId() };
    updateTree({ ...activeTree, relationships: [...activeTree.relationships, newRel] });
    return newRel;
  }, [activeTree, updateTree]);

  const deleteRelationship = useCallback((relId: string) => {
    if (!activeTree) return;
    const relationships = activeTree.relationships.filter(r => r.id !== relId);
    updateTree({ ...activeTree, relationships });
  }, [activeTree, updateTree]);

  const importTree = useCallback((tree: FamilyTree) => {
    const imported = { ...tree, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = [...trees, imported];
    save(updated);
    setActiveTreeId(imported.id);
    localStorage.setItem(ACTIVE_TREE_KEY, imported.id);
  }, [trees, save]);

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
  };
}
