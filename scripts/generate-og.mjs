// Generates public/og.png (1200×630) — the Open Graph card, rendered in the
// Atelier style and screenshotted with Playwright (no Canvas/Sharp dependency).
//   node scripts/generate-og.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'og.png');

const html = /* html */ `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;600&family=IBM+Plex+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --bone:#f4f1ea; --ink:#1b1b1b; --accent:#bf4b2c; --paper:#fbf9f4; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; }
  body {
    background:var(--bone); color:var(--ink); font-family:'Hanken Grotesk',sans-serif;
    position:relative; overflow:hidden;
    background-image:radial-gradient(rgba(27,27,27,.06) 1.4px, transparent 1.4px);
    background-size:26px 26px;
  }
  .frame {
    position:absolute; inset:36px; border:3px solid var(--ink);
    background:var(--paper); box-shadow:18px 18px 0 var(--accent);
    padding:64px 72px; display:flex; flex-direction:column; justify-content:space-between;
  }
  .top { display:flex; align-items:center; gap:22px; }
  .mark {
    width:84px; height:84px; flex:0 0 auto; border:3px solid var(--ink); background:var(--accent);
    color:#fff; display:flex; align-items:center; justify-content:center;
    font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:52px; box-shadow:6px 6px 0 var(--ink);
  }
  .eyebrow { font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:20px; letter-spacing:5px; text-transform:uppercase; color:var(--accent); }
  .wordmark { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:34px; letter-spacing:-1px; }
  h1 { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:104px; line-height:.96; letter-spacing:-4px; max-width:18ch; }
  h1 .accent { color:var(--accent); }
  .tagline { font-size:32px; line-height:1.32; color:#3a352f; max-width:30ch; margin-top:26px; }
  .foot { display:flex; align-items:center; justify-content:space-between; }
  .url { font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:24px; letter-spacing:1px; }
  .pills { display:flex; gap:12px; }
  .pill { font-family:'IBM Plex Mono',monospace; font-size:16px; font-weight:500; border:2px solid var(--ink); padding:6px 14px; }
</style></head>
<body>
  <div class="frame">
    <div class="top">
      <div class="mark">S</div>
      <div>
        <div class="eyebrow">Arbre&nbsp;Généalogique</div>
        <div class="wordmark">Suimini</div>
      </div>
    </div>
    <div>
      <h1>Préservez l'histoire de votre <span class="accent">famille</span>.</h1>
      <p class="tagline">Créez votre arbre généalogique en ligne — collaboratif, élégant, génération après génération.</p>
    </div>
    <div class="foot">
      <div class="url">suimini.vercel.app</div>
      <div class="pills"><span class="pill">GEDCOM</span><span class="pill">Collaboratif</span><span class="pill">PDF</span></div>
    </div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('Wrote', OUT);
