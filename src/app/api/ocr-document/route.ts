import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof SUPPORTED_MEDIA)[number];

export interface OcrPerson {
  role: 'subject' | 'parent' | 'father' | 'mother' | 'spouse' | 'witness' | string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  occupation: string | null;
  notes: string | null;
}

interface AnthropicTextBlock { type: string; text?: string }
interface AnthropicResponse { content?: AnthropicTextBlock[] }

function parseImage(imageBase64: string): { media: MediaType; data: string } | null {
  const m = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,([\s\S]*)$/);
  if (m) {
    const media = m[1].toLowerCase();
    if ((SUPPORTED_MEDIA as readonly string[]).includes(media)) return { media: media as MediaType, data: m[2] };
    return null;
  }
  return { media: 'image/jpeg', data: imageBase64 };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no json');
  return JSON.parse(candidate.slice(start, end + 1));
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function prompt(documentType: string): string {
  const hint = documentType && documentType !== 'auto'
    ? `Le type attendu est : ${documentType}.`
    : 'Détecte automatiquement le type de document.';
  return [
    "Analyse ce document d'état civil. " + hint,
    'Extrait les informations en JSON :',
    '{',
    '  "documentType": "birth|marriage|death|census",',
    '  "persons": [',
    '    { "role": "subject|parent|father|mother|spouse|witness", "firstName": "...", "lastName": "...", "birthDate": "YYYY-MM-DD ou null", "birthPlace": "...", "occupation": "...", "notes": "..." }',
    '  ],',
    '  "date": "YYYY-MM-DD",',
    '  "place": "...",',
    '  "confidence": 0.85,',
    '  "rawText": "transcription brute lisible"',
    '}',
    "Si un champ est illisible, mets null. Pour les dates incomplètes, utilise le format disponible (ex: \"1875\" ou \"1875-03\"). N'invente jamais d'information absente.",
    'Réponds UNIQUEMENT en JSON valide, sans texte autour ni bloc de code.',
  ].join('\n');
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "L'OCR n'est pas configuré." }, { status: 503 });

  let body: { imageBase64?: string; documentType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 }); }

  const image = body?.imageBase64 ? parseImage(body.imageBase64) : null;
  if (!image) return NextResponse.json({ error: 'Document manquant ou format non supporté (JPEG, PNG, WebP).' }, { status: 400 });

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.media, data: image.data } },
            { type: 'text', text: prompt(body.documentType || 'auto') },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: `L'API Anthropic a renvoyé une erreur (${res.status}).`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const data = (await res.json()) as AnthropicResponse;
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('').trim();

    let parsed: { documentType?: unknown; persons?: unknown[]; date?: unknown; place?: unknown; confidence?: unknown; rawText?: unknown };
    try { parsed = extractJson(text) as typeof parsed; } catch { return NextResponse.json({ error: "Réponse de l'IA illisible." }, { status: 502 }); }

    const persons: OcrPerson[] = Array.isArray(parsed.persons)
      ? parsed.persons.map((p) => {
          const o = (p || {}) as Record<string, unknown>;
          return {
            role: typeof o.role === 'string' ? o.role : 'subject',
            firstName: str(o.firstName), lastName: str(o.lastName),
            birthDate: str(o.birthDate), birthPlace: str(o.birthPlace),
            occupation: str(o.occupation), notes: str(o.notes),
          };
        })
      : [];

    return NextResponse.json({
      documentType: str(parsed.documentType) || 'auto',
      persons,
      date: str(parsed.date),
      place: str(parsed.place),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
      rawText: str(parsed.rawText) || '',
    });
  } catch {
    return NextResponse.json({ error: "Impossible d'analyser ce document." }, { status: 502 });
  }
}
