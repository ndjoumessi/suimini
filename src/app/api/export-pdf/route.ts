import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { FamilyTree, Person, Relationship } from '@/types';
import { generateFamilyBookHTML, type ExportOptions } from '@/lib/pdfTemplates';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Row → object mappers. We cannot reuse loadOneTree() here because it relies on
// the browser Supabase client (no session cookies on the server), which RLS would
// treat as anonymous. Instead we query with the request-scoped, cookie-authenticated
// client below and map the fields the booklet needs (extra JSON carries the rest,
// e.g. birthDateApprox / events).
function rowToPerson(r: any): Person {
  return {
    id: r.id, firstName: r.first_name || '', lastName: r.last_name || '',
    gender: r.gender || 'unknown',
    birthDate: r.birth_date || undefined, birthPlace: r.birth_place || undefined,
    deathDate: r.death_date || undefined, deathPlace: r.death_place || undefined,
    isAlive: r.is_alive ?? true, occupation: r.occupation || undefined, bio: r.bio || undefined,
    profilePhoto: r.profile_photo || undefined,
    createdAt: r.created_at, updatedAt: r.updated_at,
    ...(r.extra || {}),
  };
}
function rowToRel(r: any): Relationship {
  return {
    id: r.id, type: r.type, person1Id: r.person1_id, person2Id: r.person2_id,
    startDate: r.start_date || undefined, endDate: r.end_date || undefined,
    isActive: r.is_active ?? undefined, notes: r.notes || undefined,
    ...(r.extra || {}),
  };
}

// Node runtime: we read cookies + Supabase. We return the booklet HTML — the
// actual PDF rendering is done by the browser print dialog (Chromium can't run
// on Vercel), so this is a secondary/programmatic endpoint.
export const runtime = 'nodejs';

function normalizeOptions(raw: unknown): ExportOptions {
  const o = (raw ?? {}) as Partial<ExportOptions>;
  const paperSize: ExportOptions['paperSize'] =
    o.paperSize === 'A5' || o.paperSize === 'Letter' ? o.paperSize : 'A4';
  const theme: ExportOptions['theme'] =
    o.theme === 'classic' || o.theme === 'minimal' ? o.theme : 'atelier';
  return {
    includePhotos: o.includePhotos !== false,
    includeBios: o.includeBios !== false,
    includeTimeline: o.includeTimeline !== false,
    paperSize,
    theme,
  };
}

/**
 * POST /api/export-pdf  { treeId, options }
 * Returns a standalone HTML booklet for the given tree. Caller MUST be authenticated.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 500 });

  // --- AuthN ---
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() { /* read-only */ } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  // --- Payload ---
  let body: { treeId?: string; options?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }

  const treeId = body.treeId?.trim();
  if (!treeId) return NextResponse.json({ error: 'treeId manquant.' }, { status: 400 });

  const options = normalizeOptions(body.options);

  // RLS on the trees/persons tables scopes access to what this user may read.
  const { data: t } = await supabase.from('trees').select('*').eq('id', treeId).single();
  if (!t) return NextResponse.json({ error: 'Arbre introuvable.' }, { status: 404 });

  const [personsRes, relsRes] = await Promise.all([
    supabase.from('persons').select('*').eq('tree_id', treeId),
    supabase.from('relationships').select('*').eq('tree_id', treeId),
  ]);

  const tree: FamilyTree = {
    id: t.id, name: t.name, description: t.description || undefined,
    settings: t.settings || undefined, createdAt: t.created_at, updatedAt: t.updated_at,
    rootPersonId: t.settings?.rootPersonId,
    persons: (personsRes.data || []).map(rowToPerson),
    relationships: (relsRes.data || []).map(rowToRel),
  };

  const html = generateFamilyBookHTML(tree, options);
  const safeName = (tree.name || 'livret').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'livret';

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${safeName}.html"`,
    },
  });
}
