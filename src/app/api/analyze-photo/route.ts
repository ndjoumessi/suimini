import { NextResponse } from 'next/server';
import { enforceRateLimit, releaseRateLimit } from '@/lib/rateLimit';
import type { Person } from '@/types';

// Runs server-side only: ANTHROPIC_API_KEY is never exposed to the browser.
export const runtime = 'nodejs';
export const maxDuration = 60;

// Vision-capable Sonnet (même modèle épinglé dans /api/narrative).
// claude-sonnet-4-20250514 a été retiré par Anthropic le 15/06/2026 (404 sur
// /v1/messages) → remplacement recommandé officiel : claude-sonnet-4-6.
// https://platform.claude.com/docs/en/about-claude/model-deprecations
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof SUPPORTED_MEDIA)[number];

export interface DetectedFace {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  estimatedAge: 'child' | 'young' | 'adult' | 'senior' | string;
  gender: 'male' | 'female' | 'unknown' | string;
  description: string;
}

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse { content?: AnthropicTextBlock[] }

/** Split a data URL ("data:image/jpeg;base64,AAAA") or accept raw base64 + media hint. */
function parseImage(imageBase64: string): { media: MediaType; data: string } | null {
  const m = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,([\s\S]*)$/);
  if (m) {
    const media = m[1].toLowerCase();
    if ((SUPPORTED_MEDIA as readonly string[]).includes(media)) {
      return { media: media as MediaType, data: m[2] };
    }
    return null;
  }
  // No prefix: assume JPEG (the client always sends a data URL, this is a fallback).
  return { media: 'image/jpeg', data: imageBase64 };
}

const PROMPT = `Analyse cette photo de famille.
Pour chaque visage visible :
1. Donne sa position approximative en pourcentage de l'image (x, y = coin haut-gauche du visage ; width, height = taille du visage), valeurs 0–100.
2. Estime la tranche d'âge : "child" (enfant), "young" (jeune adulte), "adult" (adulte), "senior".
3. Genre apparent ("gender") : "male", "female", ou "unknown" — base-toi sur TOUS les indices visibles (pilosité faciale, coiffure, morphologie, vêtements…) et reste cohérent avec le reste de tes observations sur ce visage (ex : une barbe ou une pomme d'Adam nette pointe vers "male", pas "female"). En cas de doute réel, renvoie "unknown" plutôt qu'un genre qui contredit tes propres observations.
4. "description" : UNIQUEMENT les traits physiques distinctifs visibles (coiffure, lunettes, pilosité faciale, vêtements, expression). NE RÉPÈTE PAS l'âge ni le genre — déjà capturés dans "estimatedAge" et "gender", ne commence donc jamais par "homme"/"femme"/"jeune homme"/"jeune femme" etc.

Réponds UNIQUEMENT en JSON valide, sans texte autour, sans bloc de code :
{
  "faces": [
    { "id": 1, "x": 20, "y": 10, "width": 15, "height": 20, "estimatedAge": "adult", "gender": "male", "description": "cheveux gris, lunettes, sourire" }
  ],
  "photoDescription": "Photo de famille en extérieur...",
  "confidence": 0.85
}
S'il n'y a aucun visage, renvoie "faces": [].`;

/** Pull the JSON object out of the model reply (handles stray prose / code fences). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no json');
  return JSON.parse(candidate.slice(start, end + 1));
}

function clampPct(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export async function POST(req: Request) {
  // Rate limiting par utilisateur (coût API Anthropic) — 429 localisé si dépassé.
  const limited = await enforceRateLimit(req, '/api/analyze-photo');
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await releaseRateLimit('/api/analyze-photo'); // misconfiguration, pas la faute de l'utilisateur
    return NextResponse.json({ error: "La reconnaissance IA n'est pas configurée." }, { status: 503 });
  }

  let body: { imageBase64?: string; persons?: Person[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const image = body?.imageBase64 ? parseImage(body.imageBase64) : null;
  if (!image) {
    return NextResponse.json({ error: 'Image manquante ou format non supporté (JPEG, PNG, WebP).' }, { status: 400 });
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
        // 1500 était trop court pour une photo de groupe (chaque visage ajoute
        // ~50-80 tokens de JSON + description) : au-delà d'une dizaine de
        // personnes la réponse était tronquée en plein milieu → JSON invalide →
        // "Réponse de l'IA illisible." 4096 couvre confortablement une grande
        // photo de famille (50+ visages) sans réellement augmenter le coût pour
        // les photos courantes (1-5 visages), qui s'arrêtent bien avant la limite.
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.media, data: image.data } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      await releaseRateLimit('/api/analyze-photo'); // panne/erreur Anthropic, pas la faute de l'utilisateur
      return NextResponse.json(
        { error: `L'API Anthropic a renvoyé une erreur (${res.status}).`, detail: detail.slice(0, 400) },
        { status: 502 },
      );
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('').trim();

    let parsed: { faces?: unknown[]; photoDescription?: string; confidence?: number };
    try {
      parsed = extractJson(text) as typeof parsed;
    } catch {
      await releaseRateLimit('/api/analyze-photo');
      return NextResponse.json({ error: "Réponse de l'IA illisible." }, { status: 502 });
    }

    const faces: DetectedFace[] = Array.isArray(parsed.faces)
      ? parsed.faces.map((f, i) => {
          const o = (f || {}) as Record<string, unknown>;
          return {
            id: typeof o.id === 'number' ? o.id : i + 1,
            x: clampPct(o.x),
            y: clampPct(o.y),
            width: clampPct(o.width),
            height: clampPct(o.height),
            estimatedAge: typeof o.estimatedAge === 'string' ? o.estimatedAge : 'adult',
            gender: typeof o.gender === 'string' ? o.gender : 'unknown',
            description: typeof o.description === 'string' ? o.description : '',
          };
        })
      : [];

    return NextResponse.json({
      faces,
      photoDescription: typeof parsed.photoDescription === 'string' ? parsed.photoDescription : '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    });
  } catch {
    await releaseRateLimit('/api/analyze-photo');
    return NextResponse.json({ error: "Impossible d'analyser cette photo." }, { status: 502 });
  }
}
