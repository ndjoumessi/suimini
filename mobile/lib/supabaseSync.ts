/**
 * Supabase sync for mobile — row mappers ported from the web app's
 * src/lib/supabaseSync.ts so the column ↔ field mapping stays identical.
 * Loads trees AND writes persons (upsert / delete) under the user's RLS.
 */
import { supabase } from './supabase';
import type { FamilyTree, Person, Relationship, JournalEntry } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Person → DB row (mirror of the web personToRow; unmapped fields go to `extra`). */
function personToRow(p: Person, treeId: string): any {
  const {
    id, firstName, lastName, gender, birthDate, birthPlace, deathDate, deathPlace,
    isAlive, occupation, bio, profilePhoto, dnaOrigins, citations, customFields,
    tags, privacy, createdAt, updatedAt, ...rest
  } = p;
  return {
    id, tree_id: treeId, first_name: firstName, last_name: lastName, gender: gender ?? null,
    birth_date: birthDate ?? null, birth_place: birthPlace ?? null,
    death_date: deathDate ?? null, death_place: deathPlace ?? null,
    is_alive: isAlive ?? true, occupation: occupation ?? null, bio: bio ?? null,
    profile_photo: profilePhoto ?? null, dna_origins: dnaOrigins ?? null,
    citations: citations ?? null, custom_fields: customFields ?? null,
    tags: tags ?? null, privacy: privacy ?? null,
    extra: Object.keys(rest).length ? rest : null,
    created_at: createdAt, updated_at: updatedAt,
  };
}

export interface WriteResult { error?: string }

/** Upsert a person (insert or update). RLS: caller must own/write the tree. */
export async function upsertPersonRemote(treeId: string, person: Person): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  const { error } = await supabase
    .from('persons')
    .upsert(personToRow(person, treeId), { onConflict: 'id' });
  return error ? { error: error.message } : {};
}

/** Delete a person and any relationship touching it (FK safety). */
export async function deletePersonRemote(personId: string): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  await supabase
    .from('relationships')
    .delete()
    .or(`person1_id.eq.${personId},person2_id.eq.${personId}`);
  const { error } = await supabase.from('persons').delete().eq('id', personId);
  return error ? { error: error.message } : {};
}

function rowToPerson(r: any): Person {
  return {
    id: r.id,
    firstName: r.first_name || '',
    lastName: r.last_name || '',
    gender: r.gender || 'unknown',
    birthDate: r.birth_date || undefined,
    birthPlace: r.birth_place || undefined,
    deathDate: r.death_date || undefined,
    deathPlace: r.death_place || undefined,
    isAlive: r.is_alive ?? true,
    occupation: r.occupation || undefined,
    bio: r.bio || undefined,
    profilePhoto: r.profile_photo || undefined,
    dnaOrigins: r.dna_origins || undefined,
    citations: r.citations || undefined,
    customFields: r.custom_fields || undefined,
    tags: r.tags || undefined,
    privacy: r.privacy || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.extra || {}),
  };
}

function rowToRel(r: any): Relationship {
  return {
    id: r.id,
    type: r.type,
    person1Id: r.person1_id,
    person2Id: r.person2_id,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    isActive: r.is_active ?? undefined,
    notes: r.notes || undefined,
    ...(r.extra || {}),
  };
}

function rowToJournal(r: any): JournalEntry {
  return {
    id: r.id,
    title: r.title || '',
    date: r.date || '',
    content: r.content || '',
    mentionedPersonIds: r.mentioned_person_ids || undefined,
    photos: r.photos || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
  };
}

/** Loads every tree the connected user can see, with persons/relationships/journal. */
export async function loadTreesFromSupabase(): Promise<FamilyTree[]> {
  if (!supabase) return [];

  const { data: treeRows, error } = await supabase.from('trees').select('*');
  if (error || !treeRows) return [];

  const treeIds = treeRows.map((t: any) => t.id);
  const empty = Promise.resolve({ data: [] as any[] });
  const [persons, rels, journal] = await Promise.all([
    treeIds.length
      ? supabase.from('persons').select('*').in('tree_id', treeIds)
      : empty,
    treeIds.length
      ? supabase.from('relationships').select('*').in('tree_id', treeIds)
      : empty,
    treeIds.length
      ? supabase.from('journal_entries').select('*').in('tree_id', treeIds)
      : empty,
  ]);

  return treeRows.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description || undefined,
    settings: t.settings || undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    rootPersonId: t.settings?.rootPersonId,
    persons: (persons.data || [])
      .filter((r: any) => r.tree_id === t.id)
      .map(rowToPerson),
    relationships: (rels.data || [])
      .filter((r: any) => r.tree_id === t.id)
      .map(rowToRel),
    journal: (journal.data || [])
      .filter((r: any) => r.tree_id === t.id)
      .map(rowToJournal),
  }));
}
