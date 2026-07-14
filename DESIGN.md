---
name: Suimini
description: Arbre généalogique familial — "Veillée", l'heure du soir où l'on raconte les histoires de famille
colors:
  bg: "#16120e"
  bg-card: "#2a231a"
  bg-muted: "#372e22"
  surface-3: "#201a13"
  ink: "#f3ecdf"
  text-muted: "#aa9e8c"
  text-light: "#9c9081"
  border: "#362f26"
  border-strong: "#4a4033"
  accent: "#c9a84c"
  accent-hover: "#dcbb5e"
  accent-text: "#d4b257"
  accent-muted: "#a98f4e"
  ink-on-accent: "#171006"
  male: "#4a90d9"
  female: "#c47ba0"
  deceased: "#a2988a"
  success: "#58b294"
  danger: "#e07862"
  warning: "#d8a555"
  info: "#8aa8cc"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(2.8rem, 7vw, 5rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "2.29rem"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "1.46rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "1.5px"
rounded:
  sm: "6px"
  base: "10px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.base}"
    padding: "8px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "8px 18px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    padding: "9px 13px"
  card:
    backgroundColor: "{colors.bg-card}"
    rounded: "{rounded.lg}"
  badge:
    rounded: "{rounded.full}"
    typography: "{typography.label}"
---

# Design System: Suimini

## 1. Overview

**Creative North Star: "Veillée — the fireside hour"**

Suimini is read the way a family gathers in the evening to tell its stories: a warm ember-dark canvas, paper-cream ink, soft rounded geometry, and a single candle-gold accent that carries every action and every link. It is the nocturnal sibling of the mobile app's "Canopée" (warm paper, forest daylight) — where Canopée is the album read by daylight, Veillée is the hour the stories get told. The system exists to make documenting a family feel like an evening ritual, never an archivist's chore: names, dates and relationships are handled the way you'd handle a photograph, not a database row.

It explicitly rejects cold generic SaaS (corporate blues, sterile dashboards, tech gradients, interchangeable cards — a genealogy app is not a CRM), the cluttered dated look of old genealogy software, playful social-network gamification, and ostentatious luxury (no shiny gold-as-decoration, no showy premium). Warmth comes from precision, not embellishment.

**Key Characteristics:**
- Warm ember-dark canvas (`#16120e`) with paper-cream ink (`#f3ecdf`); a real, switchable light companion palette exists (`data-theme="light"`), never just an afterthought filter.
- One candle-gold accent (`#c9a84c`), user-themable at runtime across 6 named palettes, always rare (≤10% of a screen).
- Soft geometry chosen **by role**, not flattened to zero: 6px chips, 10px buttons/inputs, 16px cards, 22px modals, full pills.
- Warm diffuse shadows (`rgba(12, 8, 4, …)` on dark, `rgba(90, 70, 40, …)` on light) — never hard offset, never floating glow without purpose.
- Flat at rest; elevation is a response to hover/focus/selection, not a permanent decoration.

## 2. Colors

Warm neutrals (heartwood dark or bone-paper light) carry the canvas; one gold accent carries action and links; gender and status stay legible information, never decoration.

### Primary
- **Candle Gold** (`#c9a84c`, hover `#dcbb5e`, text-safe `#d4b257`): the one accent. Buttons, active tabs, links, focus rings, timeline dots, the founder/pivot node in the family tree. User-themable at runtime — 5 alternate palettes exist (Bordeaux `#c06b78`, Forêt `#6fae8a`, Ardoise `#8aa2b4`, Marine `#5b8fc0`, Terracotta `#d3845a`) — but whichever is active, it stays this rare.

### Tertiary (signal, not decoration)
- **Filiation Blue** (`#4a90d9`) / **Filiation Rose** (`#c47ba0`): gender, carried by the tree node's left bar, `PersonCard`, avatars and legends. Deliberately mode-independent — same hex in light and dark — so a person reads the same hue everywhere in the app.
- **Muted Taupe** (`#a2988a`): deceased status.
- **Warm Green** (`#58b294`) / **Warm Coral** (`#e07862`) / **Warm Amber** (`#d8a555`) / **Soft Slate-Blue** (`#8aa8cc`): success / danger / warning / info. Carried by toast icon + progress bar + text, never by a card border.

### Neutral
- **Heartwood Canvas** (`#16120e`, light `#f4f0e6`): the app background.
- **Raised Card** (`#2a231a`, light `#fcfaf3`): cards, panels — deliberately ~2× brighter than the canvas (not a subtle hue nudge) so it reads as unmistakably lifted, even in a compressed screenshot.
- **Inert / Hover Fill** (`#372e22`, light `#ffffff`): hover states, muted zones — the lightest tier on dark, lightest on light too.
- **Recessed Chrome** (`#201a13`, light `#e9e1cd`): sidebars, toolbars, inputs — its own tier, distinct from both canvas and card.
- **Paper Ink** (`#f3ecdf` on dark, `#211b12` on light): primary text.
- **Muted Ink** (`#aa9e8c` / `#9c9081`): secondary and tertiary text, both tuned ≥4.5:1 against canvas *and* card.
- **Hairline** (`#362f26`) / **Structural Border** (`#4a4033`): dividers vs. interactive outlines (inputs, buttons).

### Named Rules
**The Rare Gold Rule.** The accent is reserved for action and link — never a large fill, never a decorative background. Whatever the active theme (6 options), the accent covers roughly ≤10% of any screen.
**The Depth-Ladder Rule.** Four surface tiers, darkest to lightest: recessed chrome < canvas < raised card < hover/inert. The jump canvas→card is deliberately bold (roughly double perceived brightness), not a 2–3 RGB unit nudge — flattened tiers were a shipped regression, caught and fixed twice.
**The Signal-Not-Decor Rule.** Gender/status/semantic colors (blue, rose, green, coral, amber, slate-blue) carry real information and must never be repurposed as an aesthetic accent.

## 3. Typography

**Display Font:** Playfair Display (with Georgia, serif fallback) — titles, person names, key numbers.
**Body Font:** Figtree (with system-ui fallback) — UI chrome, body copy, form labels. Shared with the mobile app.
**Label/Mono Font:** IBM Plex Mono — dates, IDs, archival metadata, uppercase eyebrows.

**Character:** A didone display face (Playfair) for what deserves to be engraved — a name, a headline, a generation number — paired with a plain, warm humanist sans (Figtree) for everything read at length, and a quiet monospace for anything that behaves like a record label.

### Hierarchy
Type scale is a documented major-third (ratio 1.25) on a 15px base: step -1 (12px) through step 5 (45.8px).
- **Display** (500, `clamp(2.8rem, 7vw, 5rem)`, 1.02, -0.01em): masthead-level type, the one piece of type allowed to dominate a viewport (landing hero only).
- **Headline** (600, ~36.6px / step 4, 1.15): screen titles.
- **Title** (600, ~23.4px / step 2, 1.2): section and card titles; also the `.serif` utility class used throughout for names and key figures.
- **Body** (400, 15px, 1.5): interface copy; prose caps at 65–75ch.
- **Label** (500, 11px, 1.5px tracking, uppercase): the `.label` utility — metadata, form labels, archive-style eyebrows. Reserved for genuinely short strings (≤4 words), never a decorative prefix stacked above every section.

### Named Rules
**The Two-Voice Rule.** Playfair Display for what gets engraved (titles, names, generation numbers); Figtree for what gets read. No third competing display face.
**The Mono-Caps Rule.** Uppercase tracked type belongs to the `.label` monospace class, never to the display or body face, and never to a full sentence.

## 4. Elevation

Flat by default; depth is carried primarily by the surface tiers themselves (the Depth-Ladder Rule), with a warm diffuse shadow reserved for genuine elevation — never a decorative resting-state shadow on every card.

### Shadow Vocabulary
- **`--shadow-sm`** (`0 1px 2px rgba(12,8,4,.35), 0 2px 8px rgba(12,8,4,.25)`): the default resting shadow under any `.card` — a whisper, not a statement.
- **`--shadow`** (`0 4px 12px rgba(12,8,4,.35), 0 12px 32px rgba(12,8,4,.35)`): hover / active surfaces.
- **`--shadow-lg`** (`0 8px 20px rgba(12,8,4,.4), 0 24px 56px rgba(12,8,4,.45)`): toasts, dropdowns.
- **`--shadow-xl`** (`0 12px 28px rgba(12,8,4,.45), 0 36px 80px rgba(12,8,4,.5)`): modals.
- **`--shadow-accent`** (`0 0 0 1px rgba(201,168,76,.35), 0 8px 28px rgba(201,168,76,.18)`): the one glow allowed — gold-tinted, reserved for the primary button hover and other accent-carrying surfaces.

Light mode carries the same vocabulary at lower opacity and a warm-brown tint (`rgba(90,70,40,…)`) instead of near-black, so elevation reads consistently without ever looking sooty on paper.

### Named Rules
**The Whisper-Not-Shout Rule.** Shadows are warm and diffuse, never hard-offset or floating without a state to justify them. A card at rest gets `--shadow-sm` only; anything louder is a reaction to hover, focus, or selection.

## 5. Components

### Buttons
- **Shape:** 10px radius (`--radius`) at default size; 6px (`--radius-sm`) for `.btn-sm`, 12px (`--radius-md`) for `.btn-lg`. Structural 1px border in all variants.
- **Primary:** gold fill, ink-on-accent text (`#171006` — never white on gold), 700 weight. Hover brightens to `--accent-hover` and adds the gold glow shadow.
- **Secondary:** raised-card fill, full-strength ink text, structural border; hover shifts to the muted-fill tier and picks up a subtle shadow.
- **Ghost:** transparent, muted text; hover fills with the inert tier.
- **Danger:** solid danger-red fill for destructive actions.
- All variants: `translateY(1px)` + shadow removed on `:active`; 44px minimum touch target; 0.45 opacity + no pointer events when disabled.

### Badges
- **Style:** soft pill (`--radius-full`), monospace uppercase, 1px border in `currentColor`, tinted background per semantic role (male/female/alive/deceased/accent) — a background wash, never a saturated fill.

### Cards / Containers
- **Corner Style:** 16px (`--radius-lg`).
- **Background:** raised-card tier, 1px structural-hairline border, `--shadow-sm` at rest.
- **Border:** full 1px frame only — **no decorative `border-left` accent stripe**; this was an anti-pattern found and removed app-wide (bio/citation blocks, dashboard and statistics hero stats, journal entries, the printed booklet's person cards). The one legitimate exception is a card whose left bar carries real gender information (the `GENDER_BAR` signal, e.g. the ancestor cards in the relationship explorer) — that is data, not decoration.
- **Internal Padding:** 12–24px depending on density; no arbitrary odd values.

### Inputs / Fields
- **Style:** structural 1px border, 10px radius, canvas-level background (not card-level — inputs sit visually recessed).
- **Focus:** border shifts to accent gold + a 1px accent glow ring (`box-shadow: 0 0 0 1px var(--accent)`).
- **Error:** border and focus ring shift to danger-red; paired with `role="alert"` field-error text.

### Navigation (Tabs)
- **Style:** text tabs, 600 weight, muted by default; active tab turns accent-text color, 700 weight, and gets a 3px accent underline (a bottom border, not the banned side-stripe — this is the one legitimate accent-border-on-typography use, distinct from the card side-tab anti-pattern).

### Toasts (signature)
- **Style:** raised-card surface, structural border, `--shadow-lg`. Semantic meaning is carried by the icon color + a thin animated progress bar along the bottom edge, deliberately **not** a colored side-stripe.

### Tree Node (signature)
- **Shape:** 10px-radius rounded rect (`rx=10`), matching the app's default component radius exactly — the tree is not a special sharp-cornered exception.
- **Face:** a gender-tinted fill (soft blue/rose/parchment wash, distinct light and dark variants) with a bright left bar in the same `GENDER_BAR` hue — the one legitimate colored-left-bar pattern in the whole system, because it is information (who this person is), not ornament. The founder/pivot and a Focus-mode spouse read gold instead of gender-tinted, matching the one-accent rule.
- **Name:** kept in full-contrast ink regardless of the tinted face — an earlier colored-name variant failed the contrast bar and was reverted.

### Brand Mark
- **Current shape:** a hard-edged bordered square (no corner radius, 2.6px stroke) enclosing a minimal branching glyph (one parent node, two children) — `src/components/Brand.tsx`. This predates the Veillée geometry pass and is the one component in the system that still uses sharp corners; flagged here as a known inconsistency, not (yet) part of this document's prescriptions.

## 6. Do's and Don'ts

### Do:
- **Do** keep the gold accent (`#c9a84c` or whichever of the 6 themes is active) rare: action and link only, ≤10% of a screen.
- **Do** use Playfair Display for names, titles and key numbers; Figtree for everything else read at length; IBM Plex Mono only for short uppercase labels/metadata.
- **Do** pick corner radius by role from the documented scale (6 / 10 / 12 / 16 / 22 / full) — never an arbitrary px value, never a hardcoded `0`.
- **Do** keep surfaces flat at rest; let `--shadow-sm` through `--shadow-xl` respond to state, never sit as permanent decoration.
- **Do** carry gender and status as real signal (icon, bar, badge tint) in both light and dark, never by color alone without a text/icon backup.
- **Do** verify contrast in both themes: body text ≥4.5:1, large text ≥3:1, placeholders held to the same 4.5:1 bar as body text.
- **Do** respect `prefers-reduced-motion` — a crossfade or instant transition in place of every animation.

### Don't:
- **Don't** slip into cold generic SaaS: no corporate blues as a background fill, no sterile dashboard look, no tech gradients, no interchangeable identical card grids — Suimini handles family memory, not CRM data.
- **Don't** overload into dated genealogy-software density, playful gamified social-network color, or ostentatious shiny-gold luxury — warmth comes from precision, not decoration.
- **Don't** put gradient text (`background-clip: text` + gradient) anywhere; emphasis is weight and size in a single solid color.
- **Don't** add a decorative `border-left`/`border-right` accent stripe to a card, list row, or callout. The only two legitimate colored side-bars in the whole app are the tree node's gender bar and the ancestor-explorer card that mirrors it — both carry real information, not decoration.
- **Don't** use a bounce/elastic easing curve (`cubic-bezier` with overshoot); ease out with `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`) instead.
- **Don't** write full sentences in uppercase; tracked caps are reserved for the `.label` mono class at ≤4 words.
- **Don't** put muted gray text on a tinted near-white background "for elegance" — the single most common way an interface stops being readable; if contrast is even close, push toward the ink end of the ramp.
