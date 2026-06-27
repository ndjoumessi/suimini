'use client';
import { useMemo, useRef, useEffect } from 'react';
import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getDisplayName, formatYear, getAge, formatAge } from '@/lib/treeUtils';
import { ChevronUp, ChevronDown, Crown, ChevronRight } from 'lucide-react';

/* =====================================================================
   FocusTree — « Focus centré » : 3 générations à la fois (parents · focus ·
   enfants), grands nœuds lisibles, navigation haut/bas, fil d'Ariane.
   Rendu HTML (nœuds nets) + SVG (connecteurs). Modern Heritage dark.
   ===================================================================== */

const NODE_W = 200;
const NODE_H = 100;
const GAP = 28;
const ROW_V = 112;   // vertical gap between generation rows
const PADX = 52;
const PADY = 68;

// Per-generation accent line (génération 0 = la plus ancienne).
function genColor(g: number): string {
  if (g <= 1) return '#c9a84c';   // or
  if (g <= 3) return '#5b7fa6';   // bleu-gris
  if (g <= 5) return '#5b8a6e';   // vert-sauge
  return '#8a5b6e';               // rose-muted
}

function initials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
}
function avatarBg(p: Person): string {
  return p.gender === 'male' ? '#c9a84c' : p.gender === 'female' ? '#b07d92' : '#6b6b6b';
}
function dateLine(p: Person): string {
  const b = formatYear(p.birthDate);
  const d = formatYear(p.deathDate);
  if (!p.isAlive) return b && d ? `${b} – ${d}` : d ? `† ${d}` : b ? `${b} – ?` : '';
  if (!b) return '';
  const age = getAge(p.birthDate, p.deathDate);
  return age !== null ? `${b} · ${formatAge(age)}` : `${b}`;
}

/** Generation depth per person, normalized so the oldest ancestor = 0. */
function buildGenMap(tree: FamilyTree): Map<string, number> {
  const gen = new Map<string, number>();
  const start = (tree.rootPersonId && tree.persons.some(p => p.id === tree.rootPersonId))
    ? tree.rootPersonId : tree.persons[0]?.id;
  if (!start) return gen;
  gen.set(start, 0);
  const queue: string[] = [start];
  while (queue.length) {
    const id = queue.shift()!;
    const g = gen.get(id)!;
    for (const c of getChildren(id, tree.relationships, tree.persons)) {
      if (!gen.has(c.id)) { gen.set(c.id, g + 1); queue.push(c.id); }
    }
    for (const par of getParents(id, tree.relationships, tree.persons)) {
      if (!gen.has(par.id)) { gen.set(par.id, g - 1); queue.push(par.id); }
    }
    for (const sp of getSpouses(id, tree.relationships, tree.persons)) {
      if (!gen.has(sp.id)) { gen.set(sp.id, g); queue.push(sp.id); }
    }
  }
  let min = Infinity;
  for (const v of gen.values()) min = Math.min(min, v);
  if (min !== 0 && Number.isFinite(min)) for (const [k, v] of gen) gen.set(k, v - min);
  return gen;
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
  const genMap = useMemo(() => buildGenMap(tree), [tree]);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];
  // spouse bar
  for (let i = 1; i < focusRow.length; i++) {
    const ly = focusY + NODE_H / 2;
    links.push({ x1: focusX(i - 1) + NODE_W, y1: ly, x2: focusX(i), y2: ly });
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
    children.forEach((_, i) => {
      const ccx = childX(i) + NODE_W / 2;
      links.push({ x1: ccx, y1: busY, x2: ccx, y2: childrenY });
    });
  }

  // Center the horizontal scroll on the focus whenever it changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, coupleCenterX - el.clientWidth / 2);
  }, [focusId, coupleCenterX]);

  if (!focus) return null;

  const select = (id: string) => { onSelectPerson(id); if (id !== focusId) onFocus(id); };

  const renderNode = (p: Person, role: 'focus' | 'spouse' | 'parent' | 'child', x: number, ny: number) => {
    const isFocus = role === 'focus';
    const isPivot = p.id === pivotId;
    const dim = role === 'parent' || role === 'child';
    const g = genMap.get(p.id) ?? 0;
    const place = p.birthPlace?.city;
    return (
      <button
        key={`${role}-${p.id}`}
        className={`ft-node ${isFocus ? 'ft-node-focus' : ''} ${p.id === selectedPersonId ? 'ft-node-sel' : ''}`}
        style={{ left: x, top: ny, width: NODE_W, height: NODE_H, opacity: dim ? 0.82 : 1 }}
        onClick={() => select(p.id)}
        aria-label={getDisplayName(p)}
      >
        <span className="ft-gen" style={{ background: genColor(g) }} aria-hidden="true" />
        <span className="ft-gen-tag" style={{ color: genColor(g) }} aria-hidden="true">GÉN.&nbsp;{g + 1}</span>
        {isPivot && <Crown size={13} className="ft-crown" aria-hidden="true" />}
        <span className="ft-ava" style={{ background: avatarBg(p) }} aria-hidden="true">
          {p.profilePhoto
            ? <img src={p.profilePhoto} alt="" loading="lazy" decoding="async" />
            : initials(p)}
        </span>
        <span className="ft-body">
          <span className="ft-name">{p.firstName} <span className="ft-last">{p.lastName}</span></span>
          <span className="ft-dates">{dateLine(p)}</span>
          {place && <span className="ft-place">{place}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="ft-root">
      {/* Breadcrumb */}
      {crumbs.length > 1 && (
        <nav className="ft-crumbs" aria-label="Lignée">
          {crumbs.map((c, i) => (
            <span key={c.id} className="ft-crumb-wrap">
              <button className={`ft-crumb ${c.id === focusId ? 'ft-crumb-on' : ''}`} onClick={() => onFocus(c.id)}>
                {(c.lastName || c.firstName || '?').toUpperCase()}
              </button>
              {i < crumbs.length - 1 && <ChevronRight size={13} className="ft-crumb-sep" aria-hidden="true" />}
            </span>
          ))}
        </nav>
      )}

      {/* Up nav */}
      {hasParents && (
        <button className="ft-nav ft-nav-up" onClick={() => onFocus(parents[0].id)}>
          <ChevronUp size={15} aria-hidden="true" /> Voir les parents
        </button>
      )}

      <div className="ft-scroll" ref={scrollRef}>
        <div className="ft-stage" style={{ width: stageW, height: stageH }}>
          <svg className="ft-links" width={stageW} height={stageH} aria-hidden="true">
            {links.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--accent)" strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
            ))}
          </svg>
          {/* Generation band labels, centred on the connector bus between rows */}
          {hasParents && (
            <span className="ft-genband" style={{ top: parentsY + NODE_H + ROW_V / 2 }}>
              GÉNÉRATION {(genMap.get(focus.id) ?? 0) + 1}
            </span>
          )}
          {hasChildren && (
            <span className="ft-genband" style={{ top: focusY + NODE_H + ROW_V / 2 }}>
              GÉNÉRATION {(genMap.get(children[0].id) ?? (genMap.get(focus.id) ?? 0) + 1) + 1}
            </span>
          )}
          {hasParents && parents.map((p, i) => renderNode(p, 'parent', parentX(i), parentsY))}
          {focusRow.map((n, i) => renderNode(n.p, n.role, focusX(i), focusY))}
          {hasChildren && children.map((c, i) => renderNode(c, 'child', childX(i), childrenY))}
        </div>
      </div>

      {/* Down nav */}
      {hasChildren && (
        <button className="ft-nav ft-nav-down" onClick={() => onFocus(children[0].id)}>
          <ChevronDown size={15} aria-hidden="true" /> Voir les enfants
        </button>
      )}

      <style>{`
        .ft-root { position: relative; flex: 1; min-height: 0; background: var(--bg);
          background-image: radial-gradient(circle, var(--border) 1px, transparent 1px); background-size: 26px 26px; overflow: hidden; }
        .ft-scroll { position: absolute; inset: 0; overflow: auto; display: flex; }
        .ft-stage { position: relative; margin: auto; flex-shrink: 0; }
        .ft-links { position: absolute; inset: 0; pointer-events: none; }

        .ft-node { position: absolute; display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 13px;
          padding: 0 14px 0 11px; text-align: left; cursor: pointer;
          background: var(--bg-card); border: 1px solid var(--border); border-radius: 0;
          transition: border-color 160ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 160ms var(--ease-out), background 160ms; }
        .ft-node:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); transform: translateY(-2px); z-index: 2; }
        .ft-node:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .ft-node-focus { background: var(--bg-muted); border: 2px solid var(--accent); box-shadow: var(--shadow-accent); }
        .ft-node-sel { border-color: var(--accent); }
        .ft-gen { position: absolute; top: 0; left: 0; right: 0; height: 4px; }
        .ft-gen-tag { position: absolute; top: 8px; right: 9px; font-family: var(--font-mono); font-size: 8.5px; font-weight: 700; letter-spacing: 0.06em; opacity: 0.85; }
        .ft-crown { position: absolute; top: 9px; left: 9px; color: var(--accent); }
        .ft-ava { width: 52px; height: 52px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 700; font-size: 18px; color: #0d0d0d; overflow: hidden; flex-shrink: 0; justify-self: center; }
        .ft-ava img { width: 100%; height: 100%; object-fit: cover; }
        .ft-body { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .ft-name { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-last { font-weight: 600; }
        .ft-dates { font-family: var(--font-mono); font-size: 11px; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-place { font-family: var(--font-mono); font-size: 10px; color: var(--text-light); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-genband { position: absolute; left: 14px; transform: translateY(-50%); z-index: 1; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-muted); opacity: 0.7; pointer-events: none; background: var(--bg); padding: 2px 6px; }

        .ft-crumbs { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 5;
          display: flex; align-items: center; gap: 2px; max-width: calc(100% - 32px); overflow: hidden;
          background: color-mix(in srgb, var(--bg-card) 86%, transparent); backdrop-filter: blur(8px);
          border: 1px solid var(--border); padding: 5px 10px; }
        .ft-crumb { background: none; border: none; cursor: pointer; font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--text-muted); padding: 2px 4px; white-space: nowrap; transition: color 150ms; }
        .ft-crumb:hover { color: var(--ink); }
        .ft-crumb-on { color: var(--accent-text); }
        .ft-crumb-wrap { display: inline-flex; align-items: center; }
        .ft-crumb-sep { color: var(--text-light); flex-shrink: 0; }

        .ft-nav { position: absolute; left: 50%; transform: translateX(-50%); z-index: 5;
          display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
          font-family: var(--font-body); font-size: 13px; color: var(--accent-text);
          background: var(--bg-card); border: 1px solid var(--border); padding: 8px 16px; border-radius: 0;
          transition: border-color 160ms, box-shadow 200ms, color 160ms; }
        .ft-nav:hover { border-color: var(--accent); box-shadow: var(--shadow-accent); color: var(--ink); }
        .ft-nav-up { top: 52px; }
        .ft-nav-down { bottom: 18px; }

        @media (prefers-reduced-motion: reduce) {
          .ft-node, .ft-nav { transition: none; }
          .ft-node:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}
