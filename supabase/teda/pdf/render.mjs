// Rend le document de synthèse TEDA (teda_v2.html) en PDF A4 via le Chromium
// embarqué de Playwright (déjà dépendance du projet).
//
// Usage (sous Node 22 — voir CLAUDE.md) :
//   source ~/.nvm/nvm.sh && nvm use 22
//   node supabase/teda/pdf/render.mjs \
//     supabase/teda/pdf/teda_v2.html \
//     ~/Downloads/arbre_genealogique_TEDA_v2_juin2026.pdf
//
// Les polices Atelier (Bricolage Grotesque / Hanken Grotesk / IBM Plex Mono)
// sont chargées depuis Google Fonts par le HTML : une connexion réseau est
// nécessaire le temps du rendu.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const htmlPath = process.argv[2];
const outPath = process.argv[3];

if (!htmlPath || !outPath) {
  console.error('Usage: node render.mjs <input.html> <output.pdf>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
// S'assurer que les web fonts sont totalement chargées avant l'impression
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log('PDF written to', outPath);
