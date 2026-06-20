# PDF de synthèse — Famille TEDA (FOTIE)

Sources du document de synthèse familial **v2 (juin 2026)** de l'arbre TEDA (`teda1`).

## Fichiers

- `teda_v2.html` — le document complet (page de titre + 6 sections), mis en page au
  design system « Atelier » (polices Bricolage Grotesque / Hanken Grotesk / IBM Plex Mono,
  accent terracotta). Toutes les données sont en dur dans le HTML.
- `render.mjs` — script de rendu HTML → PDF A4 via le Chromium de Playwright.

## Régénérer le PDF

```bash
source ~/.nvm/nvm.sh && nvm use 22        # Node 22 (cf. CLAUDE.md)
node supabase/teda/pdf/render.mjs \
  supabase/teda/pdf/teda_v2.html \
  ~/Downloads/arbre_genealogique_TEDA_v2_juin2026.pdf
```

Le PDF généré (~9 pages) n'est pas committé. Une connexion réseau est requise au moment
du rendu (chargement des Google Fonts).

## Contenu (v2 — 20 juin 2026)

1. Page de titre — Famille TEDA (FOTIE), 7 générations
2. Présentation générale (60 membres)
3. Lignée principale — 7 générations (corrections intégrées)
4. Index alphabétique (60 membres)
5. Addendum — Enfants de TSANA Sébastien (11 membres)
6. Corrections intégrées (rattachements v2 + corrections du 13 juin 2026)
7. Points résolus vs questions ouvertes

Sources de données : `seed-teda-rpc.sql`, `update-teda-enrichissement.sql`,
`update-teda-branche-etendue.sql`, `addendum-tsana-sebastien.md`.
