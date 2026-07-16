/**
 * Archi F11 — `Person` est DUPLIQUÉ entre web (`src/types/index.ts`) et mobile
 * (`mobile/lib/types.ts`) : deux projets séparés, deux `tsconfig` (le root
 * EXCLUT `mobile/`), aucun type partagé — voir CLAUDE.md « Web ≠ mobile ».
 * Une divergence de champs entre les deux passe donc INAPERÇUE par `tsc`
 * (chaque projet type-checke son propre fichier, jamais l'un contre l'autre).
 *
 * Ce test lit les deux fichiers comme du TEXTE (aucune dépendance au tsconfig
 * mobile) et compare les champs de `interface Person`, pour ATTRAPER toute
 * divergence future NON intentionnelle sans bloquer celles déjà connues et
 * documentées (allowlist ci-dessous, à tenir à jour en même temps que les
 * types eux-mêmes).
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function extractInterfaceFields(filePath: string, interfaceName: string): string[] {
  const src = readFileSync(filePath, 'utf-8');
  const marker = `export interface ${interfaceName} {`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`interface ${interfaceName} introuvable dans ${filePath}`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  const body = src.slice(braceStart + 1, end);
  const fields: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    // Ignore les lignes de commentaire (`//`, `/**`, `*`) — seules les
    // déclarations de champ `nom?: type` ou `nom: type` nous intéressent.
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
    const m = line.match(/^(\w+)\??:/);
    if (m) fields.push(m[1]);
  }
  return fields;
}

// Divergences CONNUES et acceptées : mobile n'a pas encore de UI de galerie/
// tagging photo IA (voir mobile/lib/types.ts, en-tête « miroir web 1:1 » —
// ces deux champs sont l'exception documentée à cette intention).
const KNOWN_WEB_ONLY = new Set(['media', 'photoTags']);

test('Person : parité de champs web/mobile (hors divergences connues et documentées)', () => {
  const webFields = extractInterfaceFields(path.join(__dirname, '../src/types/index.ts'), 'Person');
  const mobileFields = extractInterfaceFields(path.join(__dirname, '../mobile/lib/types.ts'), 'Person');

  const webSet = new Set(webFields);
  const mobileSet = new Set(mobileFields);

  const missingOnMobile = webFields.filter(f => !mobileSet.has(f) && !KNOWN_WEB_ONLY.has(f));
  const missingOnWeb = mobileFields.filter(f => !webSet.has(f));
  const noLongerMissing = [...KNOWN_WEB_ONLY].filter(f => mobileSet.has(f));

  expect(missingOnMobile, 'Champ(s) web absent(s) côté mobile, hors allowlist — régression de parité non documentée').toEqual([]);
  expect(missingOnWeb, 'Champ(s) mobile absent(s) côté web — Person mobile a divergé au-delà du web').toEqual([]);
  expect(noLongerMissing, 'Un champ de KNOWN_WEB_ONLY existe maintenant côté mobile aussi — retirer de l’allowlist (parité retrouvée)').toEqual([]);
});
