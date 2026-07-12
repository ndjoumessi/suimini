import { NextResponse } from 'next/server';
import { enforceRateLimit, releaseRateLimit } from '@/lib/rateLimit';
import { normalizeOcrResult, type NormalizedPersonExtra } from '@/lib/ocrNormalization';

export const runtime = 'nodejs';
export const maxDuration = 60;

// claude-sonnet-4-20250514 a été retiré par Anthropic le 15/06/2026 (404 sur
// /v1/messages) → remplacement recommandé officiel : claude-sonnet-4-6.
// https://platform.claude.com/docs/en/about-claude/model-deprecations
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type MediaType = (typeof SUPPORTED_MEDIA)[number];

/** Types d'acte reconnus (registres d'état civil du Cameroun / région Ouest). */
export type ActeType =
  | 'acte_naissance' | 'acte_mariage' | 'acte_deces' | 'jugement_suppletif' | 'autre';

/** Rôle d'une personne dans l'acte (tokens français, alignés sur l'UI). */
export type OcrRole = 'sujet' | 'pere' | 'mere' | 'epoux' | 'epouse' | 'temoin' | string;

/** Une personne extraite de l'acte (tous les champs sont nullables). */
export interface OcrPerson {
  role: OcrRole;
  firstName: string | null;
  lastName: string | null;
  gender: 'male' | 'female' | 'unknown';
  birthDate: string | null;   // YYYY-MM-DD | YYYY | null
  birthPlace: string | null;  // "Village, Commune"
  occupation: string | null;
  notes: string | null;
}

/** Personne extraite + trace de normalisation du NOM (ajoutée côté serveur). */
export type OcrPersonNormalized = OcrPerson & NormalizedPersonExtra;

/** Lien de parenté / d'union entre deux personnes (index dans `persons`). */
export interface OcrRelation {
  from: number;
  to: number;
  type: 'parent' | 'spouse';
}

/** Forme renvoyée par POST /api/ocr-document. */
export interface OcrResult {
  type: ActeType | string;
  /** Alias rétro-compatible de `type` (l'UI historique lisait `documentType`). */
  documentType: string;
  persons: OcrPersonNormalized[];
  relations: OcrRelation[];
  acteNumber: string | null;
  commune: string | null;
  date: string | null;
  place: string | null;
  confidence: number | null;
  notes: string | null;
  rawText: string;
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

const GENDERS = new Set(['male', 'female', 'unknown']);
const gender = (v: unknown): 'male' | 'female' | 'unknown' =>
  (typeof v === 'string' && GENDERS.has(v) ? v : 'unknown') as 'male' | 'female' | 'unknown';

const num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null);

const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** Libellé FR du type d'acte attendu, transmis en indice au modèle. */
function expectedActe(documentType: string): string {
  switch (documentType) {
    case 'birth': case 'acte_naissance': return 'un acte de naissance';
    case 'marriage': case 'acte_mariage': return 'un acte de mariage';
    case 'death': case 'acte_deces': return 'un acte de décès';
    case 'census': return 'un recensement / registre de population';
    case 'jugement_suppletif': return "un jugement supplétif d'acte de naissance";
    default: return '';
  }
}

const SYSTEM_PROMPT = [
  "Tu es un expert en généalogie camerounaise, spécialisé dans les registres d'état civil de",
  "l'Ouest-Cameroun (pays bamiléké : Bafoussam, Dschang, Mbouda, Bandjoun et environs).",
  "Tu déchiffres des actes manuscrits ou dactylographiés (souvent anciens, parfois abîmés) et",
  "tu en extrais les personnes, dates, lieux et liens de parenté avec la plus grande rigueur.",
  '',
  'CONNAISSANCES CLÉS :',
  '• NOMS DE FAMILLE bamiléké : souvent en MAJUSCULES, avec de nombreuses variantes',
  "  d'orthographe d'un scribe à l'autre — un « C » prothétique (CFOTIE = FOTIE), une",
  "  apostrophe de coup de glotte (TEDA'A = TEDA), des accents flottants. Exemples de familles",
  '  et de leurs variantes : TEDA / TEDA\'A ; FOTIE / CFOTIE / CHOTIE ; DONGMO / DONMO ;',
  '  TSANA / SANA ; DJOUMESSI. Restitue le NOM tel qu\'il est ÉCRIT dans le document (la',
  '  normalisation vers la forme canonique est faite après toi) et signale les doutes dans "notes".',
  '• PRÉNOMS : français (Marie, Jean, Sébastien…) ou traditionnels bamiléké.',
  '• DATES : au format JJ/MM/AAAA ou écrites en toutes lettres en français → normalise en',
  '  "YYYY-MM-DD". Si la date est approximative ou seule l\'année est lisible → "YYYY". Sinon null.',
  '• LIEUX (naissance/décès) : villages de l\'Ouest (Bouleng, Bansoa, Zem, Kemtio, Dschang,',
  '  Bafoussam et alentours). Restitue au format "Village, Commune" quand c\'est possible.',
  '• LIENS DE PARENTÉ : repère les formulations « fils/fille de », « né de », « père »,',
  '  « mère », « époux/épouse de », « enfant de… » et rends-les dans "relations".',
  "• N° d'acte et commune de l'acte : à extraire dans \"acteNumber\" et \"commune\".",
  '',
  "N'invente JAMAIS une information absente : dans le doute, mets null et explique dans \"notes\".",
].join('\n');

function prompt(documentType: string): string {
  const acte = expectedActe(documentType);
  const hint = acte
    ? `Le document attendu est ${acte}.`
    : 'Détecte automatiquement le type de document.';
  return [
    `Analyse ce document d'état civil camerounais (région Ouest / pays bamiléké). ${hint}`,
    'Réponds STRICTEMENT avec ce JSON (rien d\'autre) :',
    '{',
    '  "type": "acte_naissance|acte_mariage|acte_deces|jugement_suppletif|autre",',
    '  "persons": [',
    '    {',
    '      "role": "sujet|pere|mere|epoux|epouse|temoin",',
    '      "lastName": "NOM tel qu\'écrit",',
    '      "firstName": "Prénom(s)",',
    '      "gender": "male|female|unknown",',
    '      "birthDate": "YYYY-MM-DD | YYYY | null",',
    '      "birthPlace": "Village, Commune | null",',
    '      "occupation": "profession | null",',
    '      "notes": "doutes de lecture, variante d\'orthographe | null"',
    '    }',
    '  ],',
    '  "relations": [ { "from": 0, "to": 1, "type": "parent|spouse" } ],',
    '  "acteNumber": "numéro de l\'acte | null",',
    '  "commune": "commune de l\'acte | null",',
    '  "date": "date de l\'acte YYYY-MM-DD | YYYY | null",',
    '  "place": "lieu de l\'acte | null",',
    '  "confidence": 0.0,',
    '  "notes": "variantes détectées, doutes globaux | null",',
    '  "rawText": "transcription brute lisible de l\'acte"',
    '}',
    'Dans "relations", "from" et "to" sont des INDEX (0-based) dans le tableau "persons" :',
    '"parent" = la personne "from" est le parent de "to" ; "spouse" = "from" et "to" sont mariés.',
    "Si un champ est illisible, mets null. N'invente jamais d'information absente.",
    'Réponds UNIQUEMENT en JSON valide, sans texte autour ni bloc de code.',
  ].join('\n');
}

export async function POST(req: Request) {
  // Rate limiting par utilisateur (coût API Anthropic) — 429 localisé si dépassé.
  const limited = await enforceRateLimit(req, '/api/ocr-document');
  if (limited) return limited;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await releaseRateLimit('/api/ocr-document'); // misconfiguration, pas la faute de l'utilisateur
    return NextResponse.json({ error: "L'OCR n'est pas configuré." }, { status: 503 });
  }

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
        system: SYSTEM_PROMPT,
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
      await releaseRateLimit('/api/ocr-document'); // panne/erreur Anthropic, pas la faute de l'utilisateur
      return NextResponse.json({ error: `L'API Anthropic a renvoyé une erreur (${res.status}).`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const data = (await res.json()) as AnthropicResponse;
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text || '').join('').trim();

    let parsed: {
      type?: unknown; documentType?: unknown; persons?: unknown[]; relations?: unknown[];
      acteNumber?: unknown; commune?: unknown; date?: unknown; place?: unknown;
      confidence?: unknown; notes?: unknown; rawText?: unknown;
    };
    try { parsed = extractJson(text) as typeof parsed; } catch {
      await releaseRateLimit('/api/ocr-document');
      return NextResponse.json({ error: "Réponse de l'IA illisible." }, { status: 502 });
    }

    const persons: OcrPerson[] = Array.isArray(parsed.persons)
      ? parsed.persons.map((p) => {
          const o = (p || {}) as Record<string, unknown>;
          return {
            role: typeof o.role === 'string' ? o.role : 'sujet',
            firstName: str(o.firstName), lastName: str(o.lastName),
            gender: gender(o.gender),
            birthDate: str(o.birthDate), birthPlace: str(o.birthPlace),
            occupation: str(o.occupation), notes: str(o.notes),
          };
        })
      : [];

    const relations: OcrRelation[] = Array.isArray(parsed.relations)
      ? parsed.relations.flatMap((r) => {
          const o = (r || {}) as Record<string, unknown>;
          const from = int(o.from), to = int(o.to);
          const type = o.type === 'parent' || o.type === 'spouse' ? o.type : null;
          if (from == null || to == null || from === to || from < 0 || to < 0 || from >= persons.length || to >= persons.length || !type) return [];
          return [{ from, to, type }];
        })
      : [];

    const type = str(parsed.type) || str(parsed.documentType) || 'autre';

    // Normalise les NOMS bamiléké (CFOTIE→FOTIE, SANA→TSANA, TEDA'A→TEDA) et
    // annote les variantes détectées — déterministe, sans réseau.
    const result: OcrResult = normalizeOcrResult({
      type,
      documentType: type, // alias rétro-compatible
      persons,
      relations,
      acteNumber: str(parsed.acteNumber),
      commune: str(parsed.commune),
      date: str(parsed.date),
      place: str(parsed.place),
      confidence: num(parsed.confidence),
      notes: str(parsed.notes),
      rawText: str(parsed.rawText) || '',
    });

    return NextResponse.json(result);
  } catch {
    await releaseRateLimit('/api/ocr-document');
    return NextResponse.json({ error: "Impossible d'analyser ce document." }, { status: 502 });
  }
}
