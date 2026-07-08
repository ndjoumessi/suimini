import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import type { FamilyTree, Person } from '@/types';

// Runs server-side only: ANTHROPIC_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';
export const maxDuration = 60;

// Model is pinned here; newer options: 'claude-sonnet-4-5' / 'claude-sonnet-4-6'.
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const REL_LABEL: Record<string, string> = {
  spouse: 'époux/épouse de',
  partner: 'partenaire de',
  parent: 'parent de',
  child: 'enfant de',
  sibling: 'frère/sœur de',
};

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse { content?: AnthropicTextBlock[] }

function displayName(p: Person): string {
  const n = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return n || 'Sans nom';
}
function year(d?: string): string {
  return d && d.length >= 4 ? d.slice(0, 4) : (d || '');
}

/** Compact, structured summary of the tree for the model (capped to keep the prompt bounded). */
function buildPrompt(tree: FamilyTree): string {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));

  const people = tree.persons.slice(0, 250).map((p) => {
    const bits: string[] = [displayName(p)];
    bits.push(p.gender === 'male' ? 'homme' : p.gender === 'female' ? 'femme' : 'autre');
    if (p.birthDate || p.deathDate) {
      bits.push(`${year(p.birthDate) || '?'}${p.isAlive ? ' (vivant·e)' : '–' + (year(p.deathDate) || '?')}`);
    }
    if (p.occupation) bits.push(p.occupation);
    if (p.birthPlace?.city) bits.push(`né·e à ${p.birthPlace.city}`);
    if (p.deathPlace?.city) bits.push(`décès à ${p.deathPlace.city}`);
    if (p.bio) bits.push(`note: ${p.bio.slice(0, 220)}`);
    return '- ' + bits.join(' · ');
  });

  const rels = tree.relationships
    .map((r) => {
      const a = byId.get(r.person1Id);
      const b = byId.get(r.person2Id);
      if (!a || !b) return null;
      return `- ${displayName(a)} ${REL_LABEL[r.type] || r.type} ${displayName(b)}`;
    })
    .filter(Boolean)
    .slice(0, 400);

  const events = tree.persons
    .flatMap((p) => (p.events || []).filter((e) => e.date).map((e) => `- ${year(e.date)} · ${displayName(p)} · ${e.type}${e.description ? ': ' + e.description.slice(0, 140) : ''}`))
    .slice(0, 200);

  const journal = (tree.journal || [])
    .map((j) => `- ${j.date || ''} · ${j.title}${j.content ? ': ' + j.content.slice(0, 240) : ''}`)
    .slice(0, 60);

  return [
    `Tu es un biographe familial. Rédige un rapport narratif en français sur la famille « ${tree.name} », à partir des données ci-dessous.`,
    '',
    `Ton et style :`,
    `- Chaleureux, élégant, intemporel — comme les pages d'un bel album de famille relié, pas un rapport technique.`,
    `- Met l'humain et les liens en avant, jamais les « données » ni les « enregistrements ».`,
    `- 4 à 7 paragraphes fluides. Pas de listes à puces, pas de titres, pas de markdown.`,
    `- N'invente aucun fait : appuie-toi uniquement sur les informations fournies ; reste évasif quand elles manquent.`,
    `- Si des lieux ou des époques reviennent, tisse-les en une trame (origines, générations, métiers, déplacements).`,
    '',
    `PERSONNES (${tree.persons.length}) :`,
    people.join('\n') || '(aucune)',
    '',
    `RELATIONS :`,
    rels.join('\n') || '(aucune)',
    '',
    `ÉVÉNEMENTS :`,
    events.join('\n') || '(aucun)',
    '',
    `JOURNAL FAMILIAL :`,
    journal.join('\n') || '(aucun)',
    '',
    `Rédige maintenant le récit, en commençant directement par le texte (aucun préambule).`,
  ].join('\n');
}

export async function POST(req: Request) {
  // Rate limiting par utilisateur (coût API Anthropic) — 429 localisé si dépassé.
  const limited = await enforceRateLimit(req, '/api/narrative');
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Le rapport narratif n'est pas configuré : la variable serveur ANTHROPIC_API_KEY est absente." },
      { status: 503 },
    );
  }

  let body: { tree?: FamilyTree };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const tree = body?.tree;
  if (!tree || !Array.isArray(tree.persons) || tree.persons.length === 0) {
    return NextResponse.json({ error: 'Cet arbre est vide : ajoutez des personnes avant de générer un rapport.' }, { status: 400 });
  }

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildPrompt(tree) }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `L'API Anthropic a renvoyé une erreur (${res.status}).`, detail: detail.slice(0, 400) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as AnthropicResponse;
    const narrative = (data.content || [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text as string)
      .join('\n')
      .trim();

    if (!narrative) {
      return NextResponse.json({ error: 'Le modèle a renvoyé une réponse vide.' }, { status: 502 });
    }

    return NextResponse.json({ narrative });
  } catch {
    return NextResponse.json({ error: 'Échec de la génération du rapport. Réessayez dans un instant.' }, { status: 500 });
  }
}
