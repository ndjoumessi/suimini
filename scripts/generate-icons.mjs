// Generates the 4 × 96×96 PNG shortcut icons declared in public/manifest.json.
// Uses Playwright (already a dev-dep) — no Sharp required.
//   node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const BONE   = '#f4f1ea';
const INK    = '#1b1b1b';
const ACCENT = '#bf4b2c';
const SIZE   = 96;

const ICONS = [
  {
    name: 'icon-shortcut-tree.png',
    svg: `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="${BONE}"/>
      <rect x="3" y="3" width="90" height="90" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <!-- trunk -->
      <rect x="44" y="56" width="8" height="22" fill="${ACCENT}" rx="1"/>
      <!-- branches -->
      <line x1="48" y1="56" x2="24" y2="38" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>
      <line x1="48" y1="56" x2="72" y2="38" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>
      <line x1="48" y1="46" x2="48" y2="28" stroke="${ACCENT}" stroke-width="5" stroke-linecap="round"/>
      <!-- person dots -->
      <circle cx="18" cy="34" r="7" fill="${ACCENT}" stroke="${INK}" stroke-width="2"/>
      <circle cx="78" cy="34" r="7" fill="${ACCENT}" stroke="${INK}" stroke-width="2"/>
      <circle cx="48" cy="22" r="7" fill="${INK}" stroke="${INK}" stroke-width="2"/>
    </svg>`,
  },
  {
    name: 'icon-shortcut-person.png',
    svg: `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="${BONE}"/>
      <rect x="3" y="3" width="90" height="90" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <!-- head -->
      <circle cx="48" cy="30" r="14" fill="${ACCENT}" stroke="${INK}" stroke-width="2.5"/>
      <!-- body -->
      <path d="M22 76 Q22 54 48 54 Q74 54 74 76" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <!-- plus -->
      <line x1="60" y1="18" x2="74" y2="18" stroke="${BONE}" stroke-width="3" stroke-linecap="round"/>
      <line x1="67" y1="11" x2="67" y2="25" stroke="${BONE}" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
  },
  {
    name: 'icon-shortcut-journal.png',
    svg: `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="${BONE}"/>
      <rect x="3" y="3" width="90" height="90" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <!-- book body -->
      <rect x="18" y="18" width="60" height="62" rx="2" fill="${BONE}" stroke="${INK}" stroke-width="2.5"/>
      <!-- spine -->
      <rect x="18" y="18" width="10" height="62" rx="2" fill="${ACCENT}" stroke="${INK}" stroke-width="2.5"/>
      <!-- lines -->
      <line x1="34" y1="35" x2="70" y2="35" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <line x1="34" y1="46" x2="70" y2="46" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <line x1="34" y1="57" x2="56" y2="57" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
    </svg>`,
  },
  {
    name: 'icon-shortcut-share.png',
    svg: `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
      <rect width="96" height="96" fill="${BONE}"/>
      <rect x="3" y="3" width="90" height="90" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <!-- nodes -->
      <circle cx="48" cy="22" r="9" fill="${ACCENT}" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="22" cy="66" r="9" fill="${INK}" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="74" cy="66" r="9" fill="${INK}" stroke="${INK}" stroke-width="2.5"/>
      <!-- edges -->
      <line x1="40" y1="30" x2="30" y2="58" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="56" y1="30" x2="66" y2="58" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`,
  },
];

function buildHtml(svg) {
  return /* html */`<!doctype html>
<html><head><meta charset="utf-8">
<style>*{margin:0;padding:0}html,body{width:${SIZE}px;height:${SIZE}px;overflow:hidden}</style>
</head><body>${svg}</body></html>`;
}

const browser = await chromium.launch();
const context = await browser.newContext();

for (const { name, svg } of ICONS) {
  const page = await context.newPage();
  await page.setViewportSize({ width: SIZE, height: SIZE });
  await page.setContent(buildHtml(svg), { waitUntil: 'domcontentloaded' });
  const out = `${PUBLIC}/${name}`;
  await page.screenshot({ path: out, type: 'png' });
  await page.close();
  console.log(`✓ ${name}`);
}

await browser.close();
console.log('\nDone — shortcut icons written to public/');
