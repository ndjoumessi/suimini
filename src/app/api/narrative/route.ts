import { NextResponse } from 'next/server';
import { enforceRateLimit, releaseRateLimit } from '@/lib/notifications/rateLimit';
import type { FamilyTree, Person } from '@/types';
import { buildGenerationMap } from '@/lib/treeUtils';
import {
  buildGenerationMembers,
  buildBranchMembers,
  eraContext,
  type NarrativeMode,
  type BranchInfo,
} from '@/lib/narrativeContext';

// Runs server-side only: ANTHROPIC_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';
export const maxDuration = 60;

// claude-sonnet-4-20250514 a été retiré par Anthropic le 15/06/2026 (404 sur
// /v1/messages) → remplacement recommandé officiel : claude-sonnet-4-6.
// https://platform.claude.com/docs/en/about-claude/model-deprecations
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
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

/** One-line member identity for the focused prompts (dates + place). */
function describeMember(p: Person): string {
  const bits: string[] = [displayName(p)];
  const b = year(p.birthDate);
  const d = year(p.deathDate);
  if (b || d) bits.push(`${b || '?'}${p.isAlive ? ' (vivant·e)' : '–' + (d || '?')}`);
  if (p.gender === 'male') bits.push('h'); else if (p.gender === 'female') bits.push('f');
  if (p.occupation) bits.push(p.occupation);
  if (p.birthPlace?.city) bits.push(`né·e à ${p.birthPlace.city}`);
  return bits.join(' · ');
}

/** GENERATION prompt — an African-genealogy historian narrates a whole generation. */
function buildGenerationPrompt(tree: FamilyTree, gen: number, members: Person[], locale: 'fr' | 'en'): string {
  const years = members
    .map((p) => parseInt(year(p.birthDate), 10))
    .filter((n) => !Number.isNaN(n));
  const minY = years.length ? Math.min(...years) : NaN;
  const maxY = years.length ? Math.max(...years) : NaN;
  const era = eraContext(minY, maxY, locale);
  const list = members.map((p) => '- ' + describeMember(p)).join('\n') || '(aucune)';
  const range = years.length ? `${minY}–${maxY}` : (locale === 'en' ? 'unknown dates' : 'dates inconnues');

  if (locale === 'en') {
    return [
      `You are a historian of African genealogy. Write a lively, respectful narrative of generation ${gen} of the "${tree.name}" family.`,
      '',
      `This generation counts ${members.length} people, born ${range}:`,
      list,
      '',
      era ? `Historical backdrop of the period: ${era}.` : 'Historical period undetermined (dates missing).',
      '',
      'Weave this Cameroonian historical context into the narrative where the dates allow, without inventing precise facts.',
      'Style: 3 to 4 flowing paragraphs, warm and familial tone, no bullet lists, no headings, no markdown. Begin directly with the narrative.',
      'Do not invent names or dates absent from the data; stay evocative when information is missing. Write in English.',
    ].join('\n');
  }
  return [
    `Tu es un historien de la généalogie africaine. Rédige un récit vivant et respectueux de la génération ${gen} de la famille « ${tree.name} ».`,
    '',
    `Cette génération compte ${members.length} personnes, nées ${range} :`,
    list,
    '',
    era ? `Contexte historique de la période : ${era}.` : 'Période historique indéterminée (dates manquantes).',
    '',
    'Tisse ce contexte historique camerounais dans le récit là où les dates le permettent, sans inventer de faits précis.',
    'Style : 3 à 4 paragraphes fluides, ton chaleureux et familial, pas de listes à puces, pas de titres, pas de markdown. Commence directement par le récit.',
    "N'invente aucun nom ni aucune date absents des données ; reste évocateur quand l'information manque. Rédige en français.",
  ].join('\n');
}

/** BRANCH prompt — narrate the descendants of one ancestor. */
function buildBranchPrompt(tree: FamilyTree, branch: BranchInfo, locale: 'fr' | 'en'): string {
  const root = branch.root;
  const b = year(root.birthDate);
  const d = year(root.deathDate);
  const life = `${b || '?'}${root.isAlive ? '' : '–' + (d || '?')}`;
  const generations = branch.maxDepth; // generations below the root

  if (locale === 'en') {
    return [
      `You are a historian of African genealogy. Write the narrative of the branch descended from ${displayName(root)} (${life}) within the "${tree.name}" family.`,
      '',
      `Direct descendants — ${branch.descendants.length} people over ${generations} generation(s):`,
      branch.textTree,
      '',
      'Highlight the geographic evolution (migrations, new cities), professions and achievements, and the growth of the family across generations.',
      'Style: 3 to 4 flowing paragraphs, warm and familial tone, no bullet lists, no headings, no markdown. Begin directly with the narrative.',
      'Do not invent names or dates absent from the data. Write in English.',
    ].join('\n');
  }
  return [
    `Tu es un historien de la généalogie africaine. Rédige le récit de la branche descendant de ${displayName(root)} (${life}) au sein de la famille « ${tree.name} ».`,
    '',
    `Descendance directe — ${branch.descendants.length} personnes sur ${generations} génération(s) :`,
    branch.textTree,
    '',
    "Mets en valeur l'évolution géographique (migrations, nouvelles villes), les métiers et réussites, et la croissance de la famille au fil des générations.",
    'Style : 3 à 4 paragraphes fluides, ton chaleureux et familial, pas de listes à puces, pas de titres, pas de markdown. Commence directement par le récit.',
    "N'invente aucun nom ni aucune date absents des données. Rédige en français.",
  ].join('\n');
}

export async function POST(req: Request) {
  // Rate limiting par utilisateur (coût API Anthropic) — 429 localisé si dépassé.
  const limited = await enforceRateLimit(req, '/api/narrative');
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await releaseRateLimit('/api/narrative'); // misconfiguration, pas la faute de l'utilisateur
    return NextResponse.json(
      { error: "Le rapport narratif n'est pas configuré : la variable serveur ANTHROPIC_API_KEY est absente." },
      { status: 503 },
    );
  }

  let body: {
    tree?: FamilyTree;
    mode?: NarrativeMode;
    generation?: number;
    rootPersonId?: string;
    locale?: 'fr' | 'en';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const tree = body?.tree;
  if (!tree || !Array.isArray(tree.persons) || tree.persons.length === 0) {
    return NextResponse.json({ error: 'Cet arbre est vide : ajoutez des personnes avant de générer un rapport.' }, { status: 400 });
  }

  const mode: NarrativeMode = body.mode === 'generation' || body.mode === 'branch' ? body.mode : 'full';
  const locale: 'fr' | 'en' = body.locale === 'en' ? 'en' : 'fr';

  // Sélection du prompt selon le mode (par défaut « full » = comportement inchangé).
  let prompt: string;
  if (mode === 'generation') {
    const gen = body.generation;
    const values = new Set(buildGenerationMap(tree).values());
    if (typeof gen !== 'number' || !values.has(gen)) {
      return NextResponse.json({ error: 'Génération invalide pour cet arbre.' }, { status: 400 });
    }
    const members = buildGenerationMembers(tree, gen);
    if (members.length === 0) {
      return NextResponse.json({ error: 'Cette génération ne contient aucune personne.' }, { status: 400 });
    }
    prompt = buildGenerationPrompt(tree, gen, members, locale);
  } else if (mode === 'branch') {
    const branch = body.rootPersonId ? buildBranchMembers(tree, body.rootPersonId) : null;
    if (!branch) {
      return NextResponse.json({ error: "La personne racine de la branche est introuvable dans cet arbre." }, { status: 400 });
    }
    prompt = buildBranchPrompt(tree, branch, locale);
  } else {
    prompt = buildPrompt(tree);
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      await releaseRateLimit('/api/narrative'); // panne/erreur Anthropic, pas la faute de l'utilisateur
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
      await releaseRateLimit('/api/narrative');
      return NextResponse.json({ error: 'Le modèle a renvoyé une réponse vide.' }, { status: 502 });
    }

    return NextResponse.json({ narrative });
  } catch {
    await releaseRateLimit('/api/narrative');
    return NextResponse.json({ error: 'Échec de la génération du rapport. Réessayez dans un instant.' }, { status: 500 });
  }
}
