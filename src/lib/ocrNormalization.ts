/**
 * Post-traitement DÉTERMINISTE des personnes extraites par l'OCR d'état civil
 * (`/api/ocr-document`). Le rôle de ce module : rapprocher les NOMS de famille
 * bamiléké de leur forme canonique (l'orthographe de l'arbre de référence) et
 * signaler la variante détectée, pour que l'UI puisse la surfacer ("TEDA'A →
 * TEDA") avant l'import.
 *
 * ⚠️ Toute la logique de normalisation vit dans `@/lib/bamilekeNames` — ce
 * module ne fait que la RÉUTILISER (aucune règle dupliquée, aucun réseau).
 */
import { canonicalize } from '@/lib/bamilekeNames';

/** Résultat de la détection de variante pour un nom donné. */
export interface VariantInfo {
  /** Forme canonique NORMALISÉE (MAJ, sans accents/apostrophes/C prothétique). */
  canonical: string;
  /** Nom tel qu'écrit dans le document (trim only), pour l'affichage du "avant". */
  original: string;
  /** Vrai si la forme écrite diffère de la canonique (variante orthographique). */
  isVariant: boolean;
}

/**
 * Détecte si `name` est une variante d'un nom canonique connu.
 *   detectVariants('CFOTIE')  → { canonical:'FOTIE',  original:'CFOTIE',  isVariant:true }
 *   detectVariants("TEDA'A")  → { canonical:'TEDA',   original:"TEDA'A",  isVariant:true }
 *   detectVariants('DJOUMESSI') → { canonical:'DJOUMESSI', original:'DJOUMESSI', isVariant:false }
 *   detectVariants('' | null | undefined) → { canonical:'', original:'', isVariant:false }
 *
 * `isVariant` compare la canonique à la forme ÉCRITE (juste passée en
 * MAJUSCULES + espaces compactés, mais accents/apostrophes CONSERVÉS) : ainsi
 * une différence d'accent, d'apostrophe glottale, de « C » prothétique ou un
 * synonyme connu déclenche la détection, mais un simple changement de casse
 * (« Fotie » → « FOTIE ») non.
 */
export function detectVariants(name: string | null | undefined): VariantInfo {
  const original = (name ?? '').trim();
  if (!original) return { canonical: '', original: '', isVariant: false };
  const canonical = canonicalize(original);
  const asWritten = original.toUpperCase().replace(/\s+/g, ' ');
  const isVariant = !!canonical && canonical !== asWritten;
  return { canonical, original, isVariant };
}

/** Champs ajoutés par la normalisation (trace de la variante détectée). */
export interface NormalizedPersonExtra {
  /** Forme canonique du NOM (ou null si vide). */
  lastNameCanonical: string | null;
  /** NOM tel qu'écrit dans le document (ou null si vide). */
  lastNameOriginal: string | null;
  /** Vrai si le NOM a été reconnu comme une variante et remplacé par sa canonique. */
  lastNameIsVariant: boolean;
}

/**
 * Normalise le NOM de famille d'une personne extraite. Si c'est une variante
 * connue (CFOTIE, SANA, TEDA'A…), remplace `lastName` par la canonique et
 * garde l'original pour l'indice UI. Sinon laisse le NOM tel quel (on ne
 * MAJUSCULE pas de force un patronyme français correctement saisi).
 * Générique : préserve tous les autres champs de la personne.
 */
export function normalizeOcrPerson<T extends { lastName?: string | null }>(
  p: T,
): T & NormalizedPersonExtra {
  const { canonical, original, isVariant } = detectVariants(p.lastName);
  return {
    ...p,
    lastName: isVariant && canonical ? canonical : (p.lastName ?? null),
    lastNameCanonical: canonical || null,
    lastNameOriginal: original || null,
    lastNameIsVariant: isVariant,
  };
}

/**
 * Normalise toutes les personnes d'un résultat OCR. Pur : renvoie un nouvel
 * objet, n'altère jamais l'entrée.
 */
export function normalizeOcrResult<
  P extends { lastName?: string | null },
  R extends { persons: P[] },
>(result: R): Omit<R, 'persons'> & { persons: (P & NormalizedPersonExtra)[] } {
  return { ...result, persons: (result.persons ?? []).map(normalizeOcrPerson) };
}
