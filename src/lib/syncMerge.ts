import { FamilyTree } from '@/types';

/**
 * Helpers PURS de la synchronisation (aucun accès réseau/storage) — extraits de
 * useFamilyStore pour être testables unitairement (e2e/sync-logic.spec.ts).
 */

/** Jeux d'ids d'un arbre, par table enfant. */
export interface TreeIdSets {
  persons: Set<string>;
  relationships: Set<string>;
  journal: Set<string>;
}

export function treeIdSets(t: FamilyTree): TreeIdSets {
  return {
    persons: new Set(t.persons.map(p => p.id)),
    relationships: new Set(t.relationships.map(r => r.id)),
    journal: new Set((t.journal || []).map(j => j.id)),
  };
}

/**
 * Retraits implicites : ids que ce client AFFICHAIT (known) et qui ont disparu de
 * l'arbre courant sans passer par delete{Person,Relationship,JournalEntry} — undo
 * d'un ajout, fusion GEDCOM, import remplaçant… À propager en soft-delete. On ne
 * compare JAMAIS à l'état distant : seuls des ids déjà vus puis retirés ICI sont
 * supprimés, donc un cache partiel/vide ne peut rien purger.
 */
export function removedIds(known: TreeIdSets | undefined, current: TreeIdSets): {
  persons: string[]; relationships: string[]; journal: string[];
} {
  if (!known) return { persons: [], relationships: [], journal: [] };
  const gone = (was: Set<string>, is: Set<string>) => [...was].filter(id => !is.has(id));
  return {
    persons: gone(known.persons, current.persons),
    relationships: gone(known.relationships, current.relationships),
    journal: gone(known.journal, current.journal),
  };
}

/**
 * Merge favouring the recently-edited LOCAL tree over a possibly-stale remote read.
 * Keeps ALL local persons/relations/journal (freshest field values, incl. renames),
 * and ADDS only remote entities absent locally AND not recently deleted here (so a
 * collaborator's addition still appears, but a local delete is never resurrected).
 * Relations are added only when both endpoints exist in the merged person set.
 * NB : les tombstones distantes (soft-delete) sont déjà filtrées au chargement,
 * donc jamais ré-ajoutées ici.
 */
export function mergeTreeFavoringLocal(local: FamilyTree, remote: FamilyTree, deleted: Set<string>): FamilyTree {
  const localPersonIds = new Set(local.persons.map(p => p.id));
  const persons = [
    ...local.persons,
    ...remote.persons.filter(p => !localPersonIds.has(p.id) && !deleted.has(p.id)),
  ];
  const personIds = new Set(persons.map(p => p.id));
  const localRelIds = new Set(local.relationships.map(r => r.id));
  const relationships = [
    ...local.relationships,
    ...remote.relationships.filter(r =>
      !localRelIds.has(r.id) && !deleted.has(r.id)
      && personIds.has(r.person1Id) && personIds.has(r.person2Id)),
  ];
  const localJournal = local.journal || [];
  const localJournalIds = new Set(localJournal.map(j => j.id));
  const journal = [
    ...localJournal,
    ...(remote.journal || []).filter(j => !localJournalIds.has(j.id) && !deleted.has(j.id)),
  ];
  return { ...local, persons, relationships, journal };
}
