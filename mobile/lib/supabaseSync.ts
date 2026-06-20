/**
 * Read-only Supabase sync for mobile — row mappers ported from the web app's
 * src/lib/supabaseSync.ts so the column ↔ field mapping stays identical. The
 * mobile client currently loads trees; writes go through the web app.
 */
import { supabase } from './supabase';
import type { FamilyTree, Person, Relationship, JournalEntry } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

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
