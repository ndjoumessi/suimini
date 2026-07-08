/**
 * Convenience hook over the Zustand family store. Exposes the active tree, its
 * stats and the people/relationship accessors the screens need.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { computeTreeStats } from '@/lib/treeUtils';
import type { FamilyTree, Person, TreeStats } from '@/lib/types';

export function useFamilyStore() {
  const trees = useStore((s) => s.trees);
  const activeTreeId = useStore((s) => s.activeTreeId);
  const syncStatus = useStore((s) => s.syncStatus);
  const hydrated = useStore((s) => s.hydrated);
  const setActiveTree = useStore((s) => s.setActiveTree);
  const refreshFromRemote = useStore((s) => s.refreshFromRemote);
  const seedDemo = useStore((s) => s.seedDemo);
  const upsertPerson = useStore((s) => s.upsertPerson);
  const removePerson = useStore((s) => s.removePerson);
  const addRelationship = useStore((s) => s.addRelationship);
  const removeRelationship = useStore((s) => s.removeRelationship);

  const activeTree: FamilyTree | null = useMemo(
    () => trees.find((t) => t.id === activeTreeId) ?? trees[0] ?? null,
    [trees, activeTreeId],
  );

  const persons: Person[] = activeTree?.persons ?? [];
  const stats: TreeStats | null = useMemo(
    () => (activeTree ? computeTreeStats(activeTree) : null),
    [activeTree],
  );

  const getPerson = (id: string): Person | undefined =>
    persons.find((p) => p.id === id);

  return {
    trees,
    activeTree,
    activeTreeId,
    persons,
    relationships: activeTree?.relationships ?? [],
    stats,
    syncStatus,
    hydrated,
    getPerson,
    setActiveTree,
    refreshFromRemote,
    seedDemo,
    upsertPerson,
    removePerson,
    addRelationship,
    removeRelationship,
  };
}
