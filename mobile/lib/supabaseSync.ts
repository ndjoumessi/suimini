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

/** Relationship → DB row (mirror of the web relToRow; unmapped fields go to `extra`). */
function relToRow(r: Relationship, treeId: string): any {
  const { id, type, person1Id, person2Id, startDate, endDate, isActive, notes, ...rest } = r;
  return {
    id, tree_id: treeId, type, person1_id: person1Id, person2_id: person2Id,
    start_date: startDate ?? null, end_date: endDate ?? null,
    is_active: isActive ?? null, notes: notes ?? null,
    extra: Object.keys(rest).length ? rest : null,
  };
}

export interface WriteResult { error?: string }

// Soft-delete (tombstones) — même architecture UPSERT-only que le web (voir
// src/lib/supabaseSync.ts + supabase/soft-delete.sql) : jamais de DELETE, une
// suppression pose deleted_at = now() et les lectures filtrent la colonne.
// Repli pré-migration : PostgREST rejette toute mention de deleted_at
// (PGRST204/42703) → on retombe sur le comportement historique (DELETE dur).
let softDeleteSupported = true;

function isMissingDeletedAt(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === 'PGRST204' || error.code === '42703')
    && String(error.message ?? '').includes('deleted_at');
}

/** Upsert a person (insert or update). RLS: caller must own/write the tree.
 * deleted_at: null — présent localement = vivant (ranime une tombstone). */
export async function upsertPersonRemote(treeId: string, person: Person): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  const row = personToRow(person, treeId);
  let { error } = await supabase
    .from('persons')
    .upsert({ ...row, deleted_at: null }, { onConflict: 'id' });
  if (error && softDeleteSupported && isMissingDeletedAt(error)) {
    softDeleteSupported = false;
    ({ error } = await supabase.from('persons').upsert(row, { onConflict: 'id' }));
  }
  return error ? { error: error.message } : {};
}

/** Soft-delete a person and any relationship touching it (tombstones). */
export async function deletePersonRemote(personId: string): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  const orFilter = `person1_id.eq.${personId},person2_id.eq.${personId}`;
  if (softDeleteSupported) {
    const now = new Date().toISOString();
    const relRes = await supabase.from('relationships').update({ deleted_at: now }).or(orFilter);
    if (!isMissingDeletedAt(relRes.error)) {
      const { error } = await supabase.from('persons').update({ deleted_at: now }).eq('id', personId);
      return error ? { error: error.message } : {};
    }
    softDeleteSupported = false; // migration pas encore passée → DELETE dur
  }
  await supabase.from('relationships').delete().or(orFilter);
  const { error } = await supabase.from('persons').delete().eq('id', personId);
  return error ? { error: error.message } : {};
}

/** Upsert a relationship (insert or update). RLS: caller must own/write the tree.
 * deleted_at: null — présent localement = vivant (ranime une tombstone). */
export async function upsertRelationshipRemote(
  treeId: string,
  rel: Relationship,
): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  const row = relToRow(rel, treeId);
  let { error } = await supabase
    .from('relationships')
    .upsert({ ...row, deleted_at: null }, { onConflict: 'id' });
  if (error && softDeleteSupported && isMissingDeletedAt(error)) {
    softDeleteSupported = false;
    ({ error } = await supabase.from('relationships').upsert(row, { onConflict: 'id' }));
  }
  return error ? { error: error.message } : {};
}

/** Soft-delete a relationship (tombstone). Repli pré-migration : DELETE dur. */
export async function deleteRelationshipRemote(relId: string): Promise<WriteResult> {
  if (!supabase) return { error: 'Supabase non configuré' };
  if (softDeleteSupported) {
    const { error } = await supabase
      .from('relationships')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', relId);
    if (!isMissingDeletedAt(error)) return error ? { error: error.message } : {};
    softDeleteSupported = false; // migration pas encore passée → DELETE dur
  }
  const { error } = await supabase.from('relationships').delete().eq('id', relId);
  return error ? { error: error.message } : {};
}

function rowToPerson(r: any): Person {
  // `extra` étalé EN PREMIER : les colonnes canoniques priment toujours sur un
  // `extra` pollué par une clé canonique résiduelle (même correctif que le web).
  return {
    ...(r.extra || {}),
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
  };
}

function rowToRel(r: any): Relationship {
  // `extra` en premier → les colonnes canoniques priment toujours (cf. rowToPerson).
  return {
    ...(r.extra || {}),
    id: r.id,
    type: r.type,
    person1Id: r.person1_id,
    person2Id: r.person2_id,
    startDate: r.start_date || undefined,
    endDate: r.end_date || undefined,
    isActive: r.is_active ?? undefined,
    notes: r.notes || undefined,
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
  // Throw on a real query error so callers can tell failure (→ stay offline,
  // keep local) from a genuine empty result (user simply has no trees).
  if (error) throw new Error(error.message);
  if (!treeRows) return [];

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

  // Filtre les tombstones soft-delete côté client (fonctionne avant ET après la
  // migration : colonne absente → rien n'est filtré).
  const live = (rows: any[] | null) => (rows || []).filter((r: any) => !r.deleted_at);

  return treeRows.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description || undefined,
    settings: t.settings || undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    rootPersonId: t.settings?.rootPersonId,
    persons: live(persons.data)
      .filter((r: any) => r.tree_id === t.id)
      .map(rowToPerson),
    relationships: live(rels.data)
      .filter((r: any) => r.tree_id === t.id)
      .map(rowToRel),
    journal: live(journal.data)
      .filter((r: any) => r.tree_id === t.id)
      .map(rowToJournal),
  }));
}
