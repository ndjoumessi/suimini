import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import type { Person } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse { content?: AnthropicTextBlock[] }

const year = (d?: string) => (d && d.length >= 4 ? d.slice(0, 4) : '');

/** Compact, prompt-safe summary of a person. */
function brief(p: Person) {
  return {
    id: p.id,
    nom: `${p.firstName} ${p.lastName}`.trim(),
    genre: p.gender,
    naissance: year(p.birthDate) || null,
    lieuNaissance: p.birthPlace?.city || null,
    deces: year(p.deathDate) || null,
    vivant: p.isAlive,
    profession: p.occupation || null,
  };
}

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('no array');
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function POST(req: Request) {
  // Rate limiting par utilisateur (coût API Anthropic) — 429 localisé si dépassé.
  const limited = await enforceRateLimit(req, '/api/search');
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "La recherche IA n'est pas configurée." }, { status: 503 });
  }

  let body: { query?: string; persons?: Person[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const query = (body.query || '').trim();
  const persons = Array.isArray(body.persons) ? body.persons.slice(0, 300) : [];
  if (!query || persons.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const prompt = [
    'Parmi ces personnes (JSON) :',
    JSON.stringify(persons.map(brief)),
    '',
    `Trouve celles qui correspondent à la requête : "${query}".`,
    "Exemples : « nés en Normandie » → filtre sur le lieu ; « dans les années 1800 » → filtre sur l'année ; « femmes avec des enfants » → genre + relations.",
    '',
    'Réponds UNIQUEMENT avec un tableau JSON (sans texte autour, sans bloc de code) des correspondances, trié par pertinence décroissante :',
    '[{"id": "...", "score": 0.0, "reason": "raison courte"}]',
    'Si rien ne correspond, renvoie [].',
  ].join('\n');

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: `L'API Anthropic a renvoyé une erreur (${res.status}).`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const data = (await res.json()) as AnthropicResponse;
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('').trim();

    let parsed: unknown;
    try { parsed = extractJsonArray(text); } catch { return NextResponse.json({ error: "Réponse illisible." }, { status: 502 }); }

    const valid = new Set(persons.map(p => p.id));
    const results = (Array.isArray(parsed) ? parsed : [])
      .map(r => {
        const o = (r || {}) as Record<string, unknown>;
        return {
          id: typeof o.id === 'string' ? o.id : '',
          score: typeof o.score === 'number' ? Math.max(0, Math.min(1, o.score)) : 0,
          reason: typeof o.reason === 'string' ? o.reason : '',
        };
      })
      .filter(r => valid.has(r.id));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Recherche impossible.' }, { status: 502 });
  }
}
