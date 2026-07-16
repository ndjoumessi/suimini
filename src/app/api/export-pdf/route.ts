import { NextResponse } from 'next/server';
import { guardTreeRead, checkOrigin } from '@/lib/apiData';
import { generateFamilyBookHTML, type ExportOptions } from '@/lib/pdfTemplates';

// Node runtime: we return the booklet HTML — the actual PDF rendering is done
// by the browser print dialog (Chromium can't run on Vercel), so this is a
// secondary/programmatic endpoint.
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
 * Returns a standalone HTML booklet for the given tree. Caller MUST be authenticated
 * and have read access to the tree.
 *
 * Archi F8 : lisait `trees`/`persons`/`relationships` DIRECTEMENT via un client
 * Supabase construit à la main — mort depuis le cutover Railway (100% des arbres
 * vivent désormais sur Railway ; ce chemin lisait un instantané figé/vide côté
 * Supabase). Route maintenant via `guardTreeRead` + `store.loadOneTree` comme le
 * reste de `/api/data/*` — même AuthZ (`canReadTreeAsMember`), même backend
 * effectif que les données réelles de l'arbre.
 */
export async function POST(req: Request) {
  const originErr = await checkOrigin();
  if (originErr) return originErr;

  // --- Payload ---
  let body: { treeId?: string; options?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 }); }

  const treeId = body.treeId?.trim();
  if (!treeId) return NextResponse.json({ error: 'treeId manquant.' }, { status: 400 });

  const guard = await guardTreeRead(treeId);
  if (!guard.ok) return guard.res;

  const options = normalizeOptions(body.options);

  const tree = await guard.store.loadOneTree(treeId);
  if (!tree) return NextResponse.json({ error: 'Arbre introuvable.' }, { status: 404 });

  const html = generateFamilyBookHTML(tree, options);
  const safeName = (tree.name || 'livret').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'livret';

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${safeName}.html"`,
    },
  });
}
