# PDF de synthèse — Famille TEDA (FOTIE)

Sources du document de synthèse familial **v2 (juin 2026)** de l'arbre TEDA (`teda1`).

## Fichiers

- `teda_v2.html` — version **française** (page de titre + 6 sections), mise en page au
  design system « Atelier » (polices Bricolage Grotesque / Hanken Grotesk / IBM Plex Mono,
  accent terracotta). Toutes les données sont en dur dans le HTML.
- `teda_v2_en.html` — **version anglaise** : même mise en page, contenu intégralement traduit.
  Les noms propres (personnes, villages), les dates et les IDs base (`teda1`, `teda-pNN`)
  restent inchangés ; seul le texte (titres, prose, libellés, en-têtes de tableaux,
  légende, notes, conventions) est traduit.
- `render.mjs` — script de rendu HTML → PDF A4 via le Chromium de Playwright (générique :
  prend le HTML en entrée et le PDF en sortie).

## Régénérer les PDF (FR + EN)

```bash
source ~/.nvm/nvm.sh && nvm use 22        # Node 22 (cf. CLAUDE.md)

# Français
node supabase/teda/pdf/render.mjs \
  supabase/teda/pdf/teda_v2.html \
  ~/Downloads/arbre_genealogique_TEDA_v2_juin2026.pdf

# English
node supabase/teda/pdf/render.mjs \
  supabase/teda/pdf/teda_v2_en.html \
  ~/Downloads/family_tree_TEDA_v2_june2026.pdf
```

Les PDF générés (~9 pages) ne sont pas committés. Une connexion réseau est requise au moment
du rendu (chargement des Google Fonts). Garder les deux HTML **en phase** : toute correction de
données doit être reportée dans `teda_v2.html` **et** `teda_v2_en.html`.

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
