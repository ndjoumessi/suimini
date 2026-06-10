// Generates iOS PWA splash screens for the sizes declared in src/app/layout.tsx.
// Uses Playwright (already a dev-dep) — no Sharp required.
//   node scripts/generate-splash.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const SIZES = [
  { w: 640,  h: 1136, name: 'splash-640x1136.png'  },
  { w: 750,  h: 1334, name: 'splash-750x1334.png'  },
  { w: 828,  h: 1792, name: 'splash-828x1792.png'  },
  { w: 1125, h: 2436, name: 'splash-1125x2436.png' },
  { w: 1170, h: 2532, name: 'splash-1170x2532.png' },
  { w: 1179, h: 2556, name: 'splash-1179x2556.png' },
  { w: 1242, h: 2208, name: 'splash-1242x2208.png' },
  { w: 1284, h: 2778, name: 'splash-1284x2778.png' },
  { w: 1290, h: 2796, name: 'splash-1290x2796.png' },
];

const svgSource = fs.readFileSync(path.join(PUBLIC, 'splash.svg'), 'utf8');

function buildHtml(w, h) {
  // Scale the 1024×1024 SVG to fill the target size with a centred crop.
  const scale = Math.max(w, h) / 1024;
  return /* html */`<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden;background:#f4f1ea}
  .wrap{
    width:${Math.round(1024*scale)}px;height:${Math.round(1024*scale)}px;
    position:absolute;
    top:50%;left:50%;
    transform:translate(-50%,-50%);
  }
  svg{width:100%;height:100%}
</style>
</head><body>
<div class="wrap">${svgSource}</div>
</body></html>`;
}

const browser = await chromium.launch();
const context = await browser.newContext();

for (const { w, h, name } of SIZES) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(buildHtml(w, h), { waitUntil: 'networkidle' });
  const out = path.join(PUBLIC, name);
  await page.screenshot({ path: out, type: 'png' });
  await page.close();
  console.log(`✓ ${name}  (${w}×${h})`);
}

await browser.close();
console.log('\nDone — splash screens written to public/');
