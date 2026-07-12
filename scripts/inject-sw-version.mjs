#!/usr/bin/env node
// Injecte le Build ID Next.js dans public/sw.js à chaque déploiement Vercel
// (voir package.json "vercel-build") — élimine le risque d'oublier de bumper
// manuellement la version de cache du Service Worker (cause de l'incident du
// 2026-07-12 : plusieurs déploiements rapprochés sans bump ont laissé des
// clients avec un mélange de chunks JS/CSS venant de builds différents).
//
// N'écrit QUE dans le répertoire de build éphémère de Vercel — jamais lors
// d'un `npm run build` local (ce script n'est appelé que par "vercel-build"),
// donc `public/sw.js` reste inchangé dans le repo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const buildIdPath = join(process.cwd(), '.next', 'BUILD_ID');
if (!existsSync(buildIdPath)) {
  console.error('[inject-sw-version] .next/BUILD_ID introuvable — lancer après `next build`.');
  process.exit(1);
}

const buildId = readFileSync(buildIdPath, 'utf8').trim();
const swPath = join(process.cwd(), 'public', 'sw.js');
const src = readFileSync(swPath, 'utf8');

const pattern = /const CACHE = ['"]suimini-static-[^'"]+['"];/;
if (!pattern.test(src)) {
  console.error('[inject-sw-version] Motif `const CACHE = \'suimini-static-...\';` introuvable dans public/sw.js.');
  process.exit(1);
}

const patched = src.replace(pattern, `const CACHE = 'suimini-static-${buildId}';`);
writeFileSync(swPath, patched);
console.log(`[inject-sw-version] public/sw.js → suimini-static-${buildId}`);
