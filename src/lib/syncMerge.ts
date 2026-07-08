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

/** Last-write-wins entre deux versions d'une même entité horodatée : garde la plus
 * récente (`updatedAt`). Départage conservateur : à horodatage égal ou distant
 * illisible → on garde le LOCAL (compatible avec l'intention FAVOR_LOCAL : une édition
 * qu'on vient de faire est plus récente → gagne ; une vraie édition distante
 * postérieure d'un collaborateur gagne). */
function newerOf<T extends { updatedAt?: string }>(localE: T, remoteE: T): T {
  const lms = Date.parse(localE.updatedAt || '');
  const rms = Date.parse(remoteE.updatedAt || '');
  if (isNaN(rms)) return localE;
  if (isNaN(lms)) return remoteE;
  return rms > lms ? remoteE : localE;
}

/**
 * Merge favouring the recently-edited LOCAL tree over a possibly-stale remote read.
 * Pour une entité présente des DEUX côtés → LAST-WRITE-WINS par `updatedAt` (une
 * édition locale toute fraîche gagne ; une édition distante réellement plus récente
 * d'un collaborateur gagne). ADDS only remote entities absent locally AND not recently
 * deleted here (so a collaborator's addition still appears, but a local delete is
 * NEVER resurrected). Relations are added only when both endpoints exist in the merged
 * person set. NB : les tombstones distantes (soft-delete) sont déjà filtrées au
 * chargement, donc jamais ré-ajoutées ici. Les relations n'ont pas d'`updatedAt` →
 * on garde le local (comportement historique) et on ajoute seulement les distantes
 * absentes.
 */
export function mergeTreeFavoringLocal(local: FamilyTree, remote: FamilyTree, deleted: Set<string>): FamilyTree {
  const remotePersonById = new Map(remote.persons.map(p => [p.id, p]));
  const localPersonIds = new Set(local.persons.map(p => p.id));
  const persons = [
    // LWW pour les personnes présentes des deux côtés.
    ...local.persons.map(lp => {
      const rp = remotePersonById.get(lp.id);
      return rp ? newerOf(lp, rp) : lp;
    }),
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
  const remoteJournalById = new Map((remote.journal || []).map(j => [j.id, j]));
  const localJournalIds = new Set(localJournal.map(j => j.id));
  const journal = [
    // LWW pour les entrées de journal présentes des deux côtés.
    ...localJournal.map(lj => {
      const rj = remoteJournalById.get(lj.id);
      return rj ? newerOf(lj, rj) : lj;
    }),
    ...(remote.journal || []).filter(j => !localJournalIds.has(j.id) && !deleted.has(j.id)),
  ];
  return { ...local, persons, relationships, journal };
}
