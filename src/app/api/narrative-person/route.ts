import { NextResponse } from 'next/server';
import type { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getSiblings, getDisplayName } from '@/lib/treeUtils';
import { eventsOverlapping } from '@/lib/history';

// Server-side only: ANTHROPIC_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse { content?: AnthropicTextBlock[] }

const year = (d?: string) => (d && d.length >= 4 ? d.slice(0, 4) : '');

/** "Marie Dupont (1850 à Rouen – 1921)" style identity line. */
function identity(p: Person): string {
  const bits = [getDisplayName(p)];
  const birth = year(p.birthDate);
  const bplace = p.birthPlace?.city;
  if (birth || bplace) bits.push(`né·e ${birth || '?'}${bplace ? ` à ${bplace}` : ''}`);
  if (!p.isAlive && (p.deathDate || p.deathPlace?.city)) {
    bits.push(`décédé·e ${year(p.deathDate) || '?'}${p.deathPlace?.city ? ` à ${p.deathPlace.city}` : ''}`);
  } else if (p.isAlive) {
    bits.push('vivant·e');
  }
  if (p.occupation) bits.push(p.occupation);
  return bits.join(', ');
}

function familyContext(p: Person, tree: FamilyTree): string {
  const rels = tree.relationships;
  const persons = tree.persons;
  const names = (list: Person[]) => list.map(getDisplayName).join(', ') || 'inconnus';
  const lines = [
    `Parents : ${names(getParents(p.id, rels, persons))}`,
    `Conjoint·e·s : ${names(getSpouses(p.id, rels, persons))}`,
    `Enfants : ${names(getChildren(p.id, rels, persons))}`,
    `Frères et sœurs : ${names(getSiblings(p.id, rels, persons))}`,
  ];
  return lines.join('\n');
}

function historyContext(p: Person): string {
  if (!p.birthDate) return 'Non déterminé.';
  const from = new Date(p.birthDate).getFullYear();
  const to = p.deathDate ? new Date(p.deathDate).getFullYear() : new Date().getFullYear();
  if (Number.isNaN(from)) return 'Non déterminé.';
  const evs = eventsOverlapping(from, Number.isNaN(to) ? from : to);
  if (!evs.length) return 'Aucun événement majeur répertorié sur cette période.';
  return evs.map(e => `${e.fr.label} (${e.start}${e.end ? `-${e.end}` : ''})`).join(', ');
}

function biographyPrompt(p: Person, tree: FamilyTree): string {
  return [
    'Tu es un généalogiste narrateur.',
    `Écris une biographie narrative et chaleureuse de ${identity(p)}.`,
    '',
    'Contexte familial :',
    familyContext(p, tree),
    '',
    `Contexte historique de l'époque : ${historyContext(p)}`,
    '',
    "Style : 3 à 4 paragraphes, ton chaleureux et respectueux, présent historique, détails probables fondés sur l'époque et le lieu (jamais inventer de faits précis non plausibles). N'invente pas de dates ou de noms absents des données.",
    '',
    'Termine EXACTEMENT par cette section :',
    '### Questions pour approfondir',
    '- (une première question concrète pour enrichir la fiche)',
    '- (une deuxième question)',
    '- (une troisième question)',
  ].join('\n');
}

function comparePrompt(a: Person, b: Person, tree: FamilyTree): string {
  return [
    'Tu es un généalogiste narrateur.',
    `Écris un récit croisé comparant les vies de ${identity(a)} et de ${identity(b)}.`,
    '',
    `Contexte familial de ${getDisplayName(a)} :`,
    familyContext(a, tree),
    `Contexte familial de ${getDisplayName(b)} :`,
    familyContext(b, tree),
    '',
    `Contexte historique : ${getDisplayName(a)} → ${historyContext(a)} ; ${getDisplayName(b)} → ${historyContext(b)}`,
    '',
    "Style : 3 à 4 paragraphes, ton chaleureux, présent historique. Mets en regard leurs époques, lieux, parcours et liens éventuels. N'invente pas de faits précis.",
    '',
    'Termine EXACTEMENT par cette section :',
    '### Questions pour approfondir',
    '- (question 1)',
    '- (question 2)',
    '- (question 3)',
  ].join('\n');
}

/** Split the model reply into the narrative body and the 3 follow-up questions. */
function parseReply(text: string): { narrative: string; questions: string[] } {
  const re = /#{0,3}\s*Questions pour approfondir\s*/i;
  const idx = text.search(re);
  if (idx === -1) return { narrative: text.trim(), questions: [] };
  const narrative = text.slice(0, idx).trim();
  const tail = text.slice(idx).replace(re, '');
  const questions = tail
    .split('\n')
    .map(l => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(l => l.length > 0)
    .slice(0, 3);
  return { narrative, questions };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Le récit IA n'est pas configuré." }, { status: 503 });
  }

  let body: { person?: Person; tree?: FamilyTree; type?: 'biography' | 'compare'; comparePerson?: Person };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { person, tree, type = 'biography', comparePerson } = body;
  if (!person || !tree) {
    return NextResponse.json({ error: 'Personne ou arbre manquant.' }, { status: 400 });
  }
  if (type === 'compare' && !comparePerson) {
    return NextResponse.json({ error: 'Seconde personne manquante pour la comparaison.' }, { status: 400 });
  }

  const prompt = type === 'compare' && comparePerson
    ? comparePrompt(person, comparePerson, tree)
    : biographyPrompt(person, tree);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: `L'API Anthropic a renvoyé une erreur (${res.status}).`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const data = (await res.json()) as AnthropicResponse;
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('').trim();
    if (!text) return NextResponse.json({ error: 'Réponse vide.' }, { status: 502 });
    return NextResponse.json(parseReply(text));
  } catch {
    return NextResponse.json({ error: "Impossible de générer le récit." }, { status: 502 });
  }
}
