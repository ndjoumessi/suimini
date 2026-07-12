'use client';
import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getDisplayName, formatYear, getAge, formatAge, buildGenerationMap, findUnion, isUnionEnded } from '@/lib/treeUtils';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';
import TreeNode from './TreeNode';
import { GENDER_BAR, unionTint } from './nodeStyle';

/* =====================================================================
   FocusTree — « Focus centré » : 3 générations à la fois (parents · focus ·
   enfants), grands nœuds lisibles, navigation haut/bas, fil d'Ariane.
   Rendu HTML (nœuds nets) + SVG (connecteurs). Modern Heritage dark.
   ===================================================================== */

const NODE_W = 220;
const NODE_H = 110;
const GAP = 28;
const ROW_V = 120;   // vertical gap between generation rows
const PADX = 52;
const PADY = 72;

// Per-generation accent line (génération 0 = la plus ancienne).
function genColor(g: number): string {
  if (g <= 1) return '#c9a84c';   // or
  if (g <= 3) return '#5b7fa6';   // bleu-gris
  if (g <= 5) return '#5b8a6e';   // vert-sauge
  return '#8a5b6e';               // rose-muted
}

function dateLine(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  if (!p.isAlive) return b && d ? `${b} – ${d}` : d ? `† ${d}` : b ? `${b} – ?` : '';
  if (!b) return '';
  const age = getAge(p.birthDate, p.deathDate);
  return age !== null ? `${b} · ${formatAge(age)}` : `${b}`;
}

/** Depth of the deepest descendant subtree under `id` (cycle-guarded). Used so the
 *  « Génération suivante » button always heads toward the deepest branch, never
 *  stranding on the eldest child before reaching the lowest generation. */
function subtreeDepth(id: string, tree: FamilyTree, seen: Set<string>): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const kids = getChildren(id, tree.relationships, tree.persons);
  if (!kids.length) return 0;
  let max = 0;
  for (const k of kids) max = Math.max(max, subtreeDepth(k.id, tree, seen));
  return max + 1;
}

interface Props {
  tree: FamilyTree;
  focusId: string;
  pivotId: string | null;            // tree root (gets the crown)
  selectedPersonId: string | null;
  onFocus: (id: string) => void;     // re-center on a person
  onSelectPerson: (id: string) => void; // open the right detail panel
}

export default function FocusTree({ tree, focusId, pivotId, selectedPersonId, onFocus, onSelectPerson }: Props) {
  const t = useTranslations('tree');
  const genMap = useMemo(() => buildGenerationMap(tree), [tree]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Indice de débordement horizontal (façon carousel) : y a-t-il du contenu masqué
  // à gauche / à droite de la zone visible ? → fondus sur les bords correspondants.
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const updateOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollWidth - el.scrollLeft - el.clientWidth > 2;
    setOverflow(o => (o.left === left && o.right === right) ? o : { left, right });
  }, []);

  const focus = tree.persons.find(p => p.id === focusId) || tree.persons[0];
  const spouses = focus ? getSpouses(focus.id, tree.relationships, tree.persons) : [];
  const parents = focus ? getParents(focus.id, tree.relationships, tree.persons) : [];
  const children = focus ? getChildren(focus.id, tree.relationships, tree.persons) : [];

  // Ancestor breadcrumb: walk up (first parent) from focus, then reverse.
  const crumbs = useMemo(() => {
    const chain: Person[] = [];
    const seen = new Set<string>();
    let cur: Person | undefined = focus;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.push(cur);
      cur = getParents(cur.id, tree.relationships, tree.persons)[0];
    }
    return chain.reverse();
  }, [focus, tree]);

  // ---- layout maths (virtual px) ----
  const rowW = (n: number) => (n > 0 ? n * NODE_W + (n - 1) * GAP : 0);
  const focusRow: { p: Person; role: 'focus' | 'spouse' }[] = focus
    ? [{ p: focus, role: 'focus' }, ...spouses.map(s => ({ p: s, role: 'spouse' as const }))]
    : [];
  const stageW = Math.max(rowW(focusRow.length), rowW(parents.length), rowW(children.length), NODE_W) + PADX * 2;
  const cx = stageW / 2;

  const frW = rowW(focusRow.length);
  const frStart = cx - frW / 2;
  const focusCenterX = frStart + NODE_W / 2;      // centre of the focus person
  const coupleCenterX = frStart + frW / 2;         // centre of the focus couple

  const hasParents = parents.length > 0;
  const hasChildren = children.length > 0;

  // « Génération suivante » heads toward the deepest branch (not just the eldest
  // child), so the button can always reach the lowest generation in the data.
  const downTarget = useMemo(() => {
    if (!children.length) return null;
    let best = children[0], bestDepth = -1;
    for (const c of children) {
      const d = subtreeDepth(c.id, tree, new Set<string>());
      if (d > bestDepth) { bestDepth = d; best = c; }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, tree]);

  // Compteurs des boutons de nav haut/bas : nombre de personnes dans la rangée
  // DÉJÀ VISIBLE à l'écran (parents / enfants du focus actuel). Un compteur
  // pointant vers une génération plus lointaine (grands-parents, petits-enfants)
  // affichait 0 dès que cette génération plus lointaine n'était pas renseignée,
  // ce qui semblait faux à côté d'une rangée visiblement peuplée.
  const prevGenCount = parents.length;
  const nextGenCount = children.length;

  // Validation dev : l'ordre des enfants affichés doit être croissant par birth_date
  // (getChildren les trie, toutes mères confondues — cf. treeUtils.compareByBirthDate).
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && focus && children.length) {
      console.log(`[FocusTree] children of ${focus.id}:`, children.map(c => c.birthDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  let y = PADY;
  const parentsY = hasParents ? y : -1;
  if (hasParents) y += NODE_H + ROW_V;
  const focusY = y;
  y += NODE_H + ROW_V;
  const childrenY = hasChildren ? y : -1;
  const stageH = (hasChildren ? childrenY + NODE_H : focusY + NODE_H) + PADY;

  const prStart = focusCenterX - rowW(parents.length) / 2;
  const chStart = coupleCenterX - rowW(children.length) / 2;
  const parentX = (i: number) => prStart + i * (NODE_W + GAP);
  const childX = (i: number) => chStart + i * (NODE_W + GAP);
  const focusX = (i: number) => frStart + i * (NODE_W + GAP);

  // ---- connectors ----
  // `ended` = union terminée (divorce/séparation) → trait pointillé + losange atténué.
  // `color` = teinte d'union (polygamie/remariage : ≥ 2 conjoints) → chaque groupe
  // d'enfants et la barre conjugale correspondante partagent la même teinte ; une
  // seule union → couleur inchangée (accent).
  const links: { x1: number; y1: number; x2: number; y2: number; ended?: boolean; color?: string }[] = [];
  // Diamond markers on each conjugal connector (◇ = lien conjugal).
  const unions: { x: number; y: number; ended?: boolean; color?: string }[] = [];
  // Une personne à ≥ 2 unions : on distingue chaque union par une teinte. Sinon,
  // aucune couleur spéciale (rendu d'origine préservé).
  const multiUnion = spouses.length >= 2;
  const spouseIndex = new Map<string, number>(spouses.map((s, i) => [s.id, i]));
  // Teinte de l'union à laquelle appartient un enfant (via son autre parent, parmi
  // les conjoints affichés). `undefined` si mono-union ou co-parent introuvable.
  const childUnionColor = (child: Person): string | undefined => {
    if (!multiUnion || !focus) return undefined;
    const coParent = getParents(child.id, tree.relationships, tree.persons)
      .find(p => p.id !== focus.id && spouseIndex.has(p.id));
    return coParent ? unionTint(spouseIndex.get(coParent.id)!) : undefined;
  };
  // spouse bar — chaque segment porte l'état de l'union focus ↔ conjoint concerné.
  for (let i = 1; i < focusRow.length; i++) {
    const ly = focusY + NODE_H / 2;
    const rel = focus ? findUnion(focus.id, focusRow[i].p.id, tree.relationships) : undefined;
    const ended = rel ? isUnionEnded(rel) : false;
    // Segment focus ↔ conjoint (i-1) : teinté par union si polygamie (et union active).
    const color = multiUnion && !ended ? unionTint(i - 1) : undefined;
    links.push({ x1: focusX(i - 1) + NODE_W, y1: ly, x2: focusX(i), y2: ly, ended, color });
    unions.push({ x: (focusX(i - 1) + NODE_W + focusX(i)) / 2, y: ly, ended, color });
  }
  // parents -> focus
  if (hasParents) {
    const busY = parentsY + NODE_H + ROW_V / 2;
    parents.forEach((_, i) => {
      const pcx = parentX(i) + NODE_W / 2;
      links.push({ x1: pcx, y1: parentsY + NODE_H, x2: pcx, y2: busY });
      links.push({ x1: pcx, y1: busY, x2: focusCenterX, y2: busY });
    });
    links.push({ x1: focusCenterX, y1: busY, x2: focusCenterX, y2: focusY });
  }
  // focus -> children
  if (hasChildren) {
    const busY = focusY + NODE_H + ROW_V / 2;
    links.push({ x1: coupleCenterX, y1: focusY + NODE_H, x2: coupleCenterX, y2: busY });
    const firstC = childX(0) + NODE_W / 2;
    const lastC = childX(children.length - 1) + NODE_W / 2;
    links.push({ x1: Math.min(firstC, coupleCenterX), y1: busY, x2: Math.max(lastC, coupleCenterX), y2: busY });
    children.forEach((c, i) => {
      const ccx = childX(i) + NODE_W / 2;
      // Le connecteur vertical vers chaque enfant prend la teinte de SON union
      // (mère/père = conjoint concerné) quand le focus a plusieurs unions.
      links.push({ x1: ccx, y1: busY, x2: ccx, y2: childrenY, color: childUnionColor(c) });
    });
  }

  // ---- Mobile swipe navigation (touch) ----
  // Up → parents · Down → children · Left/Right → previous/next sibling.
  const stageRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const nudge = (dx: number, dy: number) => {
    const el = stageRef.current;
    if (!el || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) return;
    el.style.transition = 'transform 160ms cubic-bezier(0.16,1,0.3,1)';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    window.setTimeout(() => { if (stageRef.current) stageRef.current.style.transform = 'translate(0,0)'; }, 160);
  };

  // Shared by the on-screen ▲/▼ nav bars AND the swipe gesture so they always
  // target the same person.
  const navigateGeneration = (direction: 'up' | 'down') => {
    if (direction === 'up') { if (hasParents) onFocus(parents[0].id); }
    else if (hasChildren) onFocus((downTarget ?? children[0]).id);
  };

  const goSibling = (dir: 1 | -1) => {
    // Union of BOTH parents' children (deduped, in order) so half-siblings sharing
    // only the second parent are reachable too.
    const seen = new Set<string>();
    const group: Person[] = [];
    for (const par of parents) {
      for (const c of getChildren(par.id, tree.relationships, tree.persons)) {
        if (!seen.has(c.id)) { seen.add(c.id); group.push(c); }
      }
    }
    if (group.length < 2) return;
    const idx = group.findIndex(g => g.id === focus.id);
    if (idx === -1) return;
    const next = group[(idx + dir + group.length) % group.length];
    if (next && next.id !== focus.id) { nudge(dir * -20, 0); onFocus(next.id); }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const tc = e.touches[0];
    touchRef.current = { x: tc.clientX, y: tc.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current; touchRef.current = null;
    if (!s) return;
    const tc = e.changedTouches[0];
    const dx = tc.clientX - s.x, dy = tc.clientY - s.y;
    const dt = Date.now() - s.t;
    const TH = 50;
    if (dt > 600) return;                                   // slow drag = pan, not a swipe
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;     // too small
    // Only treat a flick as navigation when the canvas can't pan further that way —
    // otherwise a normal pan of a large tree would teleport the focus.
    const el = scrollRef.current;
    const atTop = !el || el.scrollTop <= 1;
    const atBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight <= 1;
    const atLeft = !el || el.scrollLeft <= 1;
    const atRight = !el || el.scrollWidth - el.scrollLeft - el.clientWidth <= 1;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && atRight) goSibling(1);                  // left flick at right edge → next
      else if (dx > 0 && atLeft) goSibling(-1);             // right flick at left edge → previous
    } else if (dy < 0) {
      if (hasParents && atTop) { nudge(0, -20); navigateGeneration('up'); }      // up flick at top → parents
    } else if (hasChildren && atBottom) {
      nudge(0, 20); navigateGeneration('down');             // down flick at bottom → children
    }
  };

  // Center the focus couple within the AVAILABLE area (the scroll container),
  // not the viewport — so the sidebar and an open PersonPanel never hide the
  // left nodes. Re-runs on focus change AND on container resize (panel toggles).
  const recenter = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, coupleCenterX - el.clientWidth / 2);
    el.scrollTop = Math.max(0, focusY + NODE_H / 2 - el.clientHeight / 2);
    updateOverflow();
  }, [coupleCenterX, focusY, updateOverflow]);

  useEffect(() => { recenter(); }, [focusId, recenter]);

  // Recenter when the container's size changes (PersonPanel open/close, sidebar
  // collapse, window resize) so the tree always stays framed in the visible zone.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recenter());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recenter]);

  if (!focus) return null;

  const renderNode = (p: Person, role: 'focus' | 'spouse' | 'parent' | 'child', x: number, ny: number) => {
    const isPivot = p.id === pivotId;
    const g = genMap.get(p.id) ?? 0;
    return (
      <TreeNode
        key={`${role}-${p.id}`}
        person={p}
        role={role}
        x={x} y={ny} w={NODE_W} h={NODE_H}
        isPivot={isPivot}
        isSelected={p.id === selectedPersonId}
        isFocus={role === 'focus'}
        /* Spouses keep their GENDER colour (so married women read rose, men blue —
           the point of Bug 2); the conjugal link is shown by the gold diamond ◇
           connector, not by recolouring the node. Pivot stays gold. */
        isSpouse={false}
        genColor={genColor(g)}
        dateStr={dateLine(p)}
        displayName={getDisplayName(p).trim() || t('unknownNode')}
        unknownLabel={t('unknownNode')}
        genderLabel={p.gender === 'female' ? t('genderF') : p.gender === 'male' ? t('genderM') : undefined}
        onClick={() => { if (p.id !== focusId) onFocus(p.id); else onSelectPerson(p.id); }}
        onDoubleClick={() => onSelectPerson(p.id)}
      />
    );
  };

  return (
    <div className="ft-root">
      {/* Breadcrumb */}
      {crumbs.length > 1 && (
        <nav className="ft-crumbs" aria-label={t('lineageAria')}>
          {crumbs.map((c, i) => (
            <span key={c.id} className="ft-crumb-wrap">
              <button className={`ft-crumb ${c.id === focusId ? 'ft-crumb-on' : ''}`} onClick={() => onFocus(c.id)}>
                {(c.firstName || c.lastName || '?').toUpperCase()}
              </button>
              {i < crumbs.length - 1 && <ChevronRight size={13} className="ft-crumb-sep" aria-hidden="true" />}
            </span>
          ))}
        </nav>
      )}

      {/* Up nav — previous generation (+ compteur = nombre de personnes de cette génération) */}
      {hasParents && (
        <button className="ft-nav ft-nav-up" onClick={() => navigateGeneration('up')}
          aria-label={`${t('previousGeneration')}, ${t('generationCount', { n: prevGenCount })}`}>
          <ChevronUp size={14} aria-hidden="true" className="ft-nav-arrow" /> {t('previousGeneration')}
          <span className="ft-nav-count">{prevGenCount}</span>
        </button>
      )}

      <div className="ft-scroll-wrap">
      <div className="ft-scroll" ref={scrollRef} onScroll={updateOverflow} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="ft-stage" ref={stageRef} style={{ width: stageW, height: stageH }}>
          <svg className="ft-links" width={stageW} height={stageH} aria-hidden="true">
            {links.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color || 'var(--accent)'}
                strokeOpacity={l.ended ? 0.35 : l.color ? 0.7 : 0.5} strokeWidth={1.5} strokeLinecap="round"
                strokeDasharray={l.ended ? '6 5' : undefined} />
            ))}
            {/* Conjugal diamond (◇) on each spouse connector — atténué si union terminée,
                teinté par union si polygamie (assorti au groupe d'enfants correspondant). */}
            {unions.map((u, i) => (
              <rect key={`u-${i}`} x={u.x - 5} y={u.y - 5} width={10} height={10}
                transform={`rotate(45 ${u.x} ${u.y})`}
                fill="var(--bg)" stroke={u.ended ? 'var(--text-muted)' : u.color || 'var(--accent)'} strokeWidth={1.5} />
            ))}
          </svg>
          {/* Generation band labels, centred on the connector bus between rows */}
          {hasParents && (
            <span className="ft-genband" style={{ top: parentsY + NODE_H + ROW_V / 2, left: cx }}>
              — {t('generationN', { n: (genMap.get(focus.id) ?? 0) + 1 })} —
            </span>
          )}
          {hasChildren && (
            <span className="ft-genband" style={{ top: focusY + NODE_H + ROW_V / 2, left: cx }}>
              — {t('generationN', { n: (genMap.get(children[0].id) ?? (genMap.get(focus.id) ?? 0) + 1) + 1 })} —
            </span>
          )}
          {hasParents && parents.map((p, i) => renderNode(p, 'parent', parentX(i), parentsY))}
          {focusRow.map((n, i) => renderNode(n.p, n.role, focusX(i), focusY))}
          {hasChildren && children.map((c, i) => renderNode(c, 'child', childX(i), childrenY))}
        </div>
      </div>
        {/* Fondus de débordement horizontal — révèlent qu'une rangée large (fratrie
            nombreuse) déborde du viewport ; disparaissent une fois scrollé au bout. */}
        {overflow.left && (
          <div className="ft-fade ft-fade-left" aria-hidden="true">
            <ChevronLeft size={18} className="ft-fade-chev" />
          </div>
        )}
        {overflow.right && (
          <div className="ft-fade ft-fade-right" aria-hidden="true">
            <ChevronRight size={18} className="ft-fade-chev" />
          </div>
        )}
      </div>

      {/* Floating recenter — frames the tree in the visible zone (sidebar/panel aware) */}
      <button className="ft-center-btn" onClick={recenter} title={t('center')} aria-label={t('center')}>
        <Crosshair size={16} aria-hidden="true" />
      </button>

      {/* Discreet legend (bottom-left) — fades out on canvas hover so it never blocks nodes */}
      <div className="ft-legend" aria-hidden="true">
        <span className="ft-leg-item"><span className="ft-leg-bar" style={{ background: GENDER_BAR.male }} />{t('male')}</span>
        <span className="ft-leg-item"><span className="ft-leg-bar" style={{ background: GENDER_BAR.female }} />{t('female')}</span>
        <span className="ft-leg-item"><span className="ft-leg-bar" style={{ background: GENDER_BAR.pivot }} />{t('pivot')}</span>
        <span className="ft-leg-item"><span className="ft-leg-dia" />{t('spouse')}</span>
        {multiUnion && (
          <span className="ft-leg-item">
            <span className="ft-leg-bar" style={{ background: unionTint(1) }} />{t('multiUnionLegend')}
          </span>
        )}
        <span className="ft-leg-item">
          <svg width="18" height="6" aria-hidden="true" style={{ flexShrink: 0 }}>
            <line x1="0" y1="3" x2="18" y2="3" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.6" />
          </svg>
          {t('unionEnded')}
        </span>
      </div>

      {/* Down nav — next generation (+ compteur = nombre d'enfants de cette génération) */}
      {hasChildren && (
        <button className="ft-nav ft-nav-down" onClick={() => navigateGeneration('down')}
          aria-label={`${t('nextGeneration')}, ${t('generationCount', { n: nextGenCount })}`}>
          <ChevronDown size={14} aria-hidden="true" className="ft-nav-arrow" /> {t('nextGeneration')}
          <span className="ft-nav-count">{nextGenCount}</span>
        </button>
      )}

      <style>{`
        .ft-root { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
        .ft-scroll-wrap { flex: 1; min-height: 0; position: relative; display: flex; }
        .ft-scroll { flex: 1; min-height: 0; position: relative; overflow: auto; display: flex;
          background-image: radial-gradient(circle, var(--border) 1px, transparent 1px); background-size: 26px 26px; }
        /* Fondus latéraux (indice « il y a plus à voir de ce côté ») — gradient vers
           le fond + chevron discret, non interactifs. */
        .ft-fade { position: absolute; top: 0; bottom: 0; width: 60px; pointer-events: none; z-index: 3;
          display: flex; align-items: center; }
        .ft-fade-left { left: 0; justify-content: flex-start; padding-left: 6px; background: linear-gradient(to right, var(--bg) 30%, transparent); }
        .ft-fade-right { right: 0; justify-content: flex-end; padding-right: 6px; background: linear-gradient(to left, var(--bg) 30%, transparent); }
        .ft-fade-chev { color: var(--accent-text); opacity: 0.75; animation: ftFadePulse 1.6s ease-in-out infinite; }
        .ft-fade-left .ft-fade-chev { animation-name: ftFadePulseL; }
        @keyframes ftFadePulse { 0%, 100% { transform: translateX(0); opacity: 0.6; } 50% { transform: translateX(3px); opacity: 0.9; } }
        @keyframes ftFadePulseL { 0%, 100% { transform: translateX(0); opacity: 0.6; } 50% { transform: translateX(-3px); opacity: 0.9; } }
        .ft-stage { position: relative; margin: auto; flex-shrink: 0; }
        .ft-links { position: absolute; inset: 0; pointer-events: none; }

        .ft-node { position: absolute; display: flex; flex-direction: column; justify-content: center; gap: 1px;
          padding: 4px 14px 4px 20px; text-align: left; cursor: pointer; background: var(--bg-card);
          border: 1px solid var(--border); border-radius: 0;
          transition: border-color 160ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 160ms var(--ease-out), background 160ms var(--ease-out); }
        .ft-node:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); z-index: 2; }
        .ft-node:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .ft-node-sel { border-color: var(--accent); }
        /* Focus/active node: double gold ring (2px + subtle inner) + glow + a slight
           scale-up so it clearly stands out from the dimmed parents/children. The
           gender tint (inline bg) stays visible underneath. */
        .ft-node-focus { border-color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent), inset 0 0 0 4px rgba(201,168,76,0.22), var(--shadow-accent); transform: scale(1.03); z-index: 3; }
        .ft-node-focus:hover { transform: scale(1.03) translateY(-2px); }
        /* Gender bar — 6px coloured left edge, full height */
        .ft-edge { position: absolute; top: 0; bottom: 0; left: 0; width: 8px; }
        /* Generation bar — 3px along the top, starting after the gender bar */
        .ft-gen { position: absolute; top: 0; left: 8px; right: 0; height: 3px; }
        .ft-gen-tag { position: absolute; top: 7px; right: 9px; font-family: var(--font-mono); font-size: 8.5px; font-weight: 700; letter-spacing: 0.06em; opacity: 0.9; }
        .ft-crown { position: absolute; top: 7px; right: 46px; color: var(--accent); }
        /* Rangée avatar + texte : l'avatar (photo) garde sa taille, le bloc texte
           prend le reste et tronque (min-width:0 pour autoriser l'ellipsis). */
        .ft-content { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ft-content .ft-body { flex: 1; }
        .ft-body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ft-name { font-family: var(--font-body); font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-surname { font-family: var(--font-body); font-size: 13px; font-weight: 500; color: var(--text-muted); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-nickname { font-family: var(--font-body); font-style: italic; font-size: 10.5px; font-weight: 400; color: var(--text-light); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-dates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .ft-place { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-genband { position: absolute; transform: translate(-50%, -50%); z-index: 1; font-family: var(--font-mono); font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-text); pointer-events: none; background: var(--bg); padding: 2px 12px; white-space: nowrap; }

        /* Breadcrumb — solid top bar, separate clickable chips */
        .ft-crumbs { flex-shrink: 0; display: flex; align-items: center; gap: 6px; overflow-x: auto;
          background: #1a1a24; border-bottom: 1px solid var(--border); padding: 8px 12px; }
        .ft-crumbs::-webkit-scrollbar { height: 0; }
        .ft-crumb { background: var(--bg-card); border: 1px solid var(--border); cursor: pointer; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--text-muted); padding: 7px 10px; white-space: nowrap; transition: color 150ms, background 150ms, border-color 150ms; }
        .ft-crumb:hover { color: var(--ink); border-color: var(--accent); }
        .ft-crumb-on { background: var(--accent); color: var(--ink-on-accent); border-color: var(--accent); }
        .ft-crumb-wrap { display: inline-flex; align-items: center; gap: 6px; }
        .ft-crumb-sep { color: var(--text-light); flex-shrink: 0; }

        /* Generation nav — full-width bars top & bottom */
        .ft-nav { flex-shrink: 0; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
          font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink);
          background: #1a1a24; border: none; padding: 10px 16px; transition: background 160ms, color 160ms; }
        .ft-nav:hover { background: var(--bg-muted); color: var(--accent-text); }
        /* Compteur de personnes de la génération — petite pastille mono discrète. */
        .ft-nav-count { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 5px;
          font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0; color: var(--accent-text);
          background: var(--bg-card); border: 1px solid var(--border); }
        .ft-nav:hover .ft-nav-count { border-color: var(--accent); }
        .ft-nav-up { border-bottom: 1px solid var(--border); }
        .ft-nav-down { border-top: 1px solid var(--border); }
        .ft-nav-up .ft-nav-arrow { animation: ftBounceUp 1.5s ease-in-out infinite; }
        .ft-nav-down .ft-nav-arrow { animation: ftBounceDown 1.5s ease-in-out infinite; }
        @keyframes ftBounceUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes ftBounceDown { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }

        /* Floating recenter button (bottom-right of the canvas) */
        .ft-center-btn { position: absolute; right: 16px; bottom: 64px; z-index: 4;
          width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
          background: var(--bg-card); color: var(--accent-text); border: 1px solid var(--border-strong);
          cursor: pointer; box-shadow: var(--shadow); transition: border-color 150ms, color 150ms, background 150ms; }
        .ft-center-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--bg-muted); }
        .ft-center-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        /* Discreet legend — bottom-left, fades out while hovering the canvas */
        .ft-legend { position: absolute; bottom: 16px; left: 16px; z-index: 4; display: flex; align-items: center; gap: 14px;
          padding: 8px 12px; background: rgba(17,17,24,0.8); border: 1px solid var(--border); backdrop-filter: blur(2px);
          transition: opacity 200ms ease; }
        /* Fades out only while the pointer is over the legend itself (so it never
           blocks a node it happens to overlap); visible the rest of the time. */
        .ft-legend:hover { opacity: 0; }
        .ft-leg-item { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.04em; color: var(--text-muted); white-space: nowrap; }
        .ft-leg-bar { width: 4px; height: 12px; flex-shrink: 0; }
        .ft-leg-dia { width: 9px; height: 9px; flex-shrink: 0; background: var(--bg); border: 1.5px solid var(--accent); transform: rotate(45deg); }
        @media (max-width: 560px) { .ft-legend { gap: 10px; padding: 6px 9px; } .ft-leg-item { font-size: 9px; } }

        @media (prefers-reduced-motion: reduce) {
          .ft-node, .ft-nav, .ft-stage { transition: none !important; }
          .ft-node:hover { transform: none; }
          .ft-node-focus, .ft-node-focus:hover { transform: scale(1.03); }
          .ft-nav-arrow { animation: none !important; }
          .ft-fade-chev { animation: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
