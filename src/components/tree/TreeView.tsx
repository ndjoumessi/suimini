'use client';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getSiblings, getDisplayName, formatYear, getAge, formatAge, personCompleteness, findRelationPath, describeRelation, buildGenerationMap, findUnion, isUnionEnded } from '@/lib/treeUtils';
import { joinTreeCursors, presenceColor, collaborationEnabled, type CursorPeer } from '@/lib/collaboration';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Plus, Sprout, Camera, CheckCircle2, FileText, MapPin, Crown } from 'lucide-react';
import FocusTree from './FocusTree';
import TreeToolbar from './TreeToolbar';
import { nodeStyle, nameLines, GENDER_BAR, unionTint, currentNodeMode } from './nodeStyle';

/** Runtime node-layout dimensions. On desktop these are EXACTLY the historical
 *  module constants (so desktop rendering is byte-for-byte unchanged); on phones
 *  they shrink so the careful SVG layout stays legible on a small viewport. */
interface Dims {
  NODE_W: number; NODE_H: number; H_GAP: number; V_GAP: number;
  FONT_NAME: number; FONT_LAST: number; FONT_DATE: number;
}
const DESKTOP_DIMS: Dims = {
  NODE_W: 220, NODE_H: 90, H_GAP: 36, V_GAP: 78,
  FONT_NAME: 14, FONT_LAST: 13, FONT_DATE: 11,
};
const MOBILE_DIMS: Dims = {
  NODE_W: 150, NODE_H: 64, H_GAP: 18, V_GAP: 50,
  FONT_NAME: 12, FONT_LAST: 11, FONT_DATE: 9,
};

/** Corner indicator badges (decorative): photos, completeness, sources.
 *  Each badge sits on a small light chip and carries a <title> tooltip. */
function NodeBadges({ person, labels, dims }: {
  person: Person;
  labels: { photos: string; complete: string; sources: string };
  dims: Dims;
}) {
  const { NODE_W, NODE_H } = dims;
  const hasPhotos = !!(person.profilePhoto || person.photos?.length);
  const isComplete = personCompleteness(person) >= 80;
  const hasSources = !!(person.sources?.length || person.citations?.length);

  const items: { key: string; title: string; color: string; icon: React.ReactNode }[] = [];
  if (hasPhotos) items.push({ key: 'photos', title: labels.photos, color: 'var(--accent)', icon: <Camera size={13} /> });
  if (isComplete) items.push({ key: 'complete', title: labels.complete, color: 'var(--success)', icon: <CheckCircle2 size={13} /> });
  if (hasSources) items.push({ key: 'sources', title: labels.sources, color: 'var(--text-muted)', icon: <FileText size={13} /> });
  if (items.length === 0) return null;

  const CHIP = 18, GAP = 3;
  // Row anchored to the BOTTOM-right corner, growing leftwards. Bottom-right keeps
  // clear of the avatar (left), the name/date text (left), and the root crown (top-right).
  const startX = NODE_W - 6 - CHIP - (items.length - 1) * (CHIP + GAP);
  const y = NODE_H - 6 - CHIP;
  return (
    <g style={{ pointerEvents: 'none' }} aria-hidden="true">
      {items.map((it, i) => {
        const x = startX + i * (CHIP + GAP);
        return (
          <g key={it.key} transform={`translate(${x}, ${y})`}>
            <title>{it.title}</title>
            <rect width={CHIP} height={CHIP} rx={2} fill="var(--bg-card)" stroke="var(--border)" strokeWidth={0.75} />
            <g transform="translate(2, 2)" style={{ color: it.color }} stroke={it.color}>
              {it.icon}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/**
 * Monochrome WARM-NEUTRAL ramp, used ONLY by the fan chart so its concentric
 * ancestor rings stay distinguishable. The vertical tree reads generation by
 * vertical POSITION; the cuir-taupe accent stays reserved for root / selection.
 */
function taupeScale(t: number): string {
  const a = [211, 204, 192]; // #d3ccc0
  const b = [132, 124, 112]; // #847c70
  const k = Math.max(0, Math.min(1, t));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

interface TreeNode { person: Person; x: number; y: number; role?: 'spouse' }
/** `ended` = union terminée (divorce/séparation) → trait pointillé.
 *  `a`/`b` = les deux personnes que le segment relie (pour surligner un chemin de
 *  parenté) ; un tronc familial partagé ne porte que `a` (le parent). */
interface Edge { x1: number; y1: number; x2: number; y2: number; type: string; ended?: boolean; a?: string; b?: string; color?: string; }
interface Pearl { x: number; y: number; ended?: boolean; color?: string; }

interface Props {
  tree: FamilyTree;
  selectedPersonId: string | null;
  /** One-shot person id to navigate to (e.g. from search): re-roots + centers the tree. */
  navTarget?: string | null;
  /** Called once navTarget has been consumed, so the parent can clear it. */
  onNavConsumed?: () => void;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
  onExport?: () => void;
  /** Public/read-only mode: hides editing affordances (no add, no selection panel). */
  readOnly?: boolean;
}

// "Album de famille relié" — register-card nodes (see DESIGN.md). Width/height stay
// uniform so the elbow-bus layout maths (edges, centring, minimap) hold; the senior
// UI pass widened the GAPS for legibility/breathing room rather than the cards.
// NODE_W/NODE_H/H_GAP/V_GAP are now RUNTIME dims (see Dims): desktop keeps the
// historical 190/88/32/76; mobile shrinks them. SPINE/GRID are size-invariant.
const SPINE = 6;    // gender-coloured left bar width
const GRID = 24; // canvas dot-grid spacing

export default function TreeView({ tree, selectedPersonId, navTarget, onNavConsumed, onSelectPerson, onAddPerson, onExport, readOnly = false }: Props) {
  const t = useTranslations('tree');
  const tc = useTranslations('collaboration');
  // Libellés des types d'événements (réutilise personPanel.event_* — pas de doublon i18n).
  const tp = useTranslations('personPanel');
  const { user } = useAuth();
  // Read once per render (not once per node — see nodeStyle.ts's comment).
  const nodeMode = currentNodeMode();
  // Responsive node-layout dims (desktop = historical constants, byte-for-byte).
  const isMobile = useIsMobile();
  // « Focus centré » (3 générations) by default; « complète » = the full pan/zoom tree.
  const [treeMode, setTreeMode] = useState<'focus' | 'full'>('focus');
  const baseDims = isMobile ? MOBILE_DIMS : DESKTOP_DIMS;
  // Vue complète: +50% breathing room between cards (legibility).
  const dims = treeMode === 'full' ? { ...baseDims, H_GAP: Math.round(baseDims.H_GAP * 1.5), V_GAP: Math.round(baseDims.V_GAP * 1.5) } : baseDims;
  const { NODE_W, NODE_H, H_GAP, V_GAP } = dims;
  // OTHER connected users on this tree (excludes the current user), each with
  // their latest cursor position. Empty when offline/guest or alone — the
  // cluster + cursors render nothing in that case. ONE channel powers both.
  const [peers, setPeers] = useState<CursorPeer[]>([]);
  // Handle to the live-cursor channel (move broadcaster + leave). Held in a ref
  // so the throttled mousemove handler can broadcast without re-subscribing.
  const cursorRef = useRef<{ move: (x: number, y: number, layout?: 'vertical' | 'fan') => void; leave: () => void } | null>(null);
  // Throttle guard for cursor broadcasts (~50ms) and a 1s tick to fade stale cursors.
  const lastCursorSentRef = useRef(0);
  const [, setCursorTick] = useState(0);
  const [rootId, setRootId] = useState(tree.rootPersonId || tree.persons[0]?.id || null);
  // Currently-centred person in « Focus » mode (defaults to the root/pivot).
  const [focusPersonId, setFocusPersonId] = useState<string | null>(tree.rootPersonId || tree.persons[0]?.id || null);
  const [scale, setScale] = useState(1.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMoved, setDragMoved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showLegend, setShowLegend] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'fan'>('vertical');
  // Focus mode: when set, dims everyone outside the focus person's close family.
  const [focusId, setFocusId] = useState<string | null>(null);
  // Rich hover tooltip: the person under the pointer + its container-relative anchor.
  // Null when nothing is hovered or while panning (cleared on drag start).
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  // Délai d'apparition du tooltip (~400 ms) : évite le clignotement en balayant
  // l'arbre à la souris. Sur mobile, un APPUI LONG (500 ms) montre le tooltip sans
  // déclencher « ouvrir la fiche » (le tap simple reste la sélection).
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressShownRef = useRef(false);
  const clearHoverTimer = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
  };
  const clearLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };

  // Chemin de parenté « Comment X est lié à Y ? » : suite d'ids (BFS via
  // findRelationPath) surlignée en BLEU INFO (var(--info)) — distinct de l'or
  // accent (pivot/spine) pour ne jamais confondre les deux signaux.
  const [kinPath, setKinPath] = useState<string[] | null>(null);
  const [kinResult, setKinResult] = useState<{ label: string; steps: number } | 'notfound' | null>(null);
  // Navigation clavier (vue Complète) : flèches = nœud connecté dans la direction
  // (haut = parent, bas = enfant, gauche/droite = fratrie/conjoint), Entrée = fiche.
  // kbFocusId reste MONTÉ malgré la virtualisation ; le focus DOM est reposé après
  // rendu via la map de refs.
  const [kbFocusId, setKbFocusId] = useState<string | null>(null);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  // Surlignage de recherche SANS re-centrage : halo vert tireté sur tous les nœuds
  // dont le nom matche la requête, sans changer la racine ni le pan — pour repérer
  // plusieurs personnes d'un coup dans un grand arbre (complément du re-root).
  const [highlightQ, setHighlightQ] = useState<string | null>(null);

  const rootPerson = tree.persons.find(p => p.id === rootId);

  const computeKin = (aId: string, bId: string) => {
    if (!aId || !bId || aId === bId) return;
    const path = findRelationPath(aId, bId, tree.relationships, tree.persons);
    if (!path) { setKinPath(null); setKinResult('notfound'); return; }
    setKinPath(path);
    setKinResult({
      label: describeRelation(aId, bId, path, tree.relationships, tree.persons),
      steps: path.length - 1,
    });
  };
  const clearKin = () => { setKinPath(null); setKinResult(null); };

  // Un chemin/surlignage calculé sur un autre arbre n'a pas de sens : on l'efface
  // au changement d'arbre. Pattern « adjust state during render » (pas d'effet →
  // pas de rendu intermédiaire avec l'état périmé).
  const [prevTreeId, setPrevTreeId] = useState(tree.id);
  if (prevTreeId !== tree.id) {
    setPrevTreeId(tree.id);
    setKinPath(null);
    setKinResult(null);
    setHighlightQ(null);
  }

  // Keep a VALID root selected as persons load / change after mount. `rootId` is
  // seeded once via useState, so without this it stays null when the first person
  // is added to an empty tree (or stale after switching trees / deleting the root)
  // — and buildLayout then returns zero nodes, so the person exists in DB but no
  // SVG node renders. Re-point it to the tree's declared root, else the first person.
  useEffect(() => {
    const valid = rootId && tree.persons.some(p => p.id === rootId);
    if (valid) return;
    const next = (tree.rootPersonId && tree.persons.some(p => p.id === tree.rootPersonId))
      ? tree.rootPersonId
      : (tree.persons[0]?.id ?? null);
    if (next !== rootId) setRootId(next);
  }, [tree.persons, tree.rootPersonId, rootId]);

  // Keep the focused person valid; fall back to the current root.
  useEffect(() => {
    if (!focusPersonId || !tree.persons.some(p => p.id === focusPersonId)) setFocusPersonId(rootId);
  }, [tree.persons, rootId, focusPersonId]);

  // Close-family id set for focus mode (focus person + spouses + parents + children + siblings).
  const focusSet: Set<string> | null = (() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const helper of [getSpouses, getParents, getChildren, getSiblings]) {
      for (const rel of helper(focusId, tree.relationships, tree.persons)) set.add(rel.id);
    }
    return set;
  })();
  const inFocus = (id: string) => !focusSet || focusSet.has(id);

  const buildLayout = useCallback(() => {
    if (!rootId || !rootPerson) return { nodes: [] as TreeNode[], edges: [] as Edge[], pearls: [] as Pearl[] };
    const nodes: TreeNode[] = [];
    const edges: Edge[] = [];
    const pearls: Pearl[] = [];
    const visited = new Set<string>();

    function placeFamily(personId: string, genY: number, centerX: number) {
      if (visited.has(personId)) return;
      visited.add(personId);
      const person = tree.persons.find(p => p.id === personId);
      if (!person) return;

      const spouses = getSpouses(personId, tree.relationships, tree.persons).filter(s => !visited.has(s.id));

      // Polygamie / remariage : ≥ 2 conjoints AFFICHÉS → on distingue chaque union
      // (barre conjugale + groupe d'enfants correspondant) par une teinte muette.
      const multiUnion = spouses.length >= 2;
      const spouseIndex = new Map<string, number>(spouses.map((s, i) => [s.id, i]));
      // Teinte de l'union d'un enfant, via son autre parent parmi les conjoints affichés.
      const childUnionColor = (childId: string): string | undefined => {
        if (!multiUnion) return undefined;
        const coParent = getParents(childId, tree.relationships, tree.persons)
          .find(p => p.id !== personId && spouseIndex.has(p.id));
        return coParent ? unionTint(spouseIndex.get(coParent.id)!) : undefined;
      };

      // Couple row centred on `centerX`; spouses extend to the right (x positive).
      const unit = 1 + spouses.length;
      const rowW = unit * NODE_W + (unit - 1) * H_GAP;
      const mainX = centerX - rowW / 2;

      nodes.push({ person, x: mainX, y: genY });
      let prevNodeX = mainX;

      spouses.forEach((spouse, si) => {
        visited.add(spouse.id);
        const sx = prevNodeX + NODE_W + H_GAP;
        nodes.push({ person: spouse, x: sx, y: genY, role: 'spouse' });
        const lineY = genY + NODE_H / 2;
        // Union terminée (divorce/séparation) → connecteur pointillé + losange atténué.
        const rel = findUnion(personId, spouse.id, tree.relationships);
        const ended = rel ? isUnionEnded(rel) : false;
        // Teinte d'union (polygamie, union active) : assortie au groupe d'enfants.
        const uColor = multiUnion && !ended ? unionTint(si) : undefined;
        edges.push({ x1: prevNodeX + NODE_W, y1: lineY, x2: sx, y2: lineY, type: 'spouse', ended, a: personId, b: spouse.id, color: uColor });
        pearls.push({ x: prevNodeX + NODE_W + H_GAP / 2, y: lineY, ended, color: uColor });
        prevNodeX = sx;
      });

      const coupleMidX = centerX;

      // Children descend (y positive) via an elbow trunk + bus.
      const children = getChildren(personId, tree.relationships, tree.persons);
      if (children.length > 0) {
        const childY = genY + NODE_H + V_GAP;
        const childTotalW = children.length * (NODE_W + H_GAP) - H_GAP;
        const childStartX = coupleMidX - childTotalW / 2;
        const childMidY = genY + NODE_H + V_GAP / 2;
        const trunkTopY = spouses.length === 1 ? genY + NODE_H / 2 : genY + NODE_H;

        edges.push({ x1: coupleMidX, y1: trunkTopY, x2: coupleMidX, y2: childMidY, type: 'parent', a: personId });

        children.forEach((child, i) => {
          const childX = childStartX + i * (NODE_W + H_GAP);
          const childMidX = childX + NODE_W / 2;
          // Le segment horizontal (branche) + la descente verticale vers l'enfant
          // prennent la teinte de son union quand le parent a plusieurs conjoints.
          const uColor = childUnionColor(child.id);
          edges.push({ x1: coupleMidX, y1: childMidY, x2: childMidX, y2: childMidY, type: 'parent', a: personId, b: child.id, color: uColor });
          edges.push({ x1: childMidX, y1: childMidY, x2: childMidX, y2: childY, type: 'parent', a: personId, b: child.id, color: uColor });
          placeFamily(child.id, childY, childMidX);
        });
      }

      // Parents + grandparents ascend (y negative), root only.
      if (personId === rootId) {
        const parents = getParents(personId, tree.relationships, tree.persons);
        if (parents.length > 0) {
          const parentY = genY - NODE_H - V_GAP;
          const parentTotalW = parents.length * (NODE_W + H_GAP) - H_GAP;
          const parentStartX = centerX - parentTotalW / 2;
          const rootMidX = mainX + NODE_W / 2;
          const midY = genY - V_GAP / 2;

          parents.forEach((parent, i) => {
            const parentX = parentStartX + i * (NODE_W + H_GAP);
            const parentMidX2 = parentX + NODE_W / 2;
            if (!visited.has(parent.id)) {
              visited.add(parent.id);
              nodes.push({ person: parent, x: parentX, y: parentY });
            }
            edges.push({ x1: parentMidX2, y1: parentY + NODE_H, x2: parentMidX2, y2: midY, type: 'parent', a: parent.id, b: personId });
            edges.push({ x1: parentMidX2, y1: midY, x2: rootMidX, y2: midY, type: 'parent', a: parent.id, b: personId });
            edges.push({ x1: rootMidX, y1: midY, x2: rootMidX, y2: genY, type: 'parent', a: parent.id, b: personId });

            const grandparents = getParents(parent.id, tree.relationships, tree.persons);
            if (grandparents.length > 0) {
              const gpY = parentY - NODE_H - V_GAP;
              grandparents.forEach((gp, j) => {
                const gpX = parentX + (j - (grandparents.length - 1) / 2) * (NODE_W + H_GAP);
                if (!visited.has(gp.id)) {
                  visited.add(gp.id);
                  nodes.push({ person: gp, x: gpX, y: gpY });
                  edges.push({ x1: gpX + NODE_W / 2, y1: gpY + NODE_H, x2: gpX + NODE_W / 2, y2: parentY - V_GAP / 2, type: 'parent', a: gp.id, b: parent.id });
                  edges.push({ x1: gpX + NODE_W / 2, y1: parentY - V_GAP / 2, x2: parentMidX2, y2: parentY - V_GAP / 2, type: 'parent', a: gp.id, b: parent.id });
                  edges.push({ x1: parentMidX2, y1: parentY - V_GAP / 2, x2: parentMidX2, y2: parentY, type: 'parent', a: gp.id, b: parent.id });
                }
              });
            }
          });

          if (parents.length === 2) {
            const p0Right = parentStartX + NODE_W;
            const p1Left = parentStartX + NODE_W + H_GAP;
            const lineY = parentY + NODE_H / 2;
            const rel = findUnion(parents[0].id, parents[1].id, tree.relationships);
            const ended = rel ? isUnionEnded(rel) : false;
            edges.push({ x1: p0Right, y1: lineY, x2: p1Left, y2: lineY, type: 'spouse', ended, a: parents[0].id, b: parents[1].id });
            pearls.push({ x: parentStartX + NODE_W + H_GAP / 2, y: lineY, ended });
          }
        }
      }
    }

    placeFamily(rootId, 0, 0);

    // Re-anchor so the ROOT node's centre sits exactly at content (0, 0). The
    // centring effect can then just set offset = (cw/2, ch/2) — no SVG-coordinate
    // maths, no dependency on layout timing (fixes the persistent off-centre bug).
    const root = nodes.find(n => n.person.id === rootId);
    if (root) {
      const dx = -(root.x + NODE_W / 2);
      const dy = -(root.y + NODE_H / 2);
      for (const n of nodes) { n.x += dx; n.y += dy; }
      for (const e of edges) { e.x1 += dx; e.y1 += dy; e.x2 += dx; e.y2 += dy; }
      for (const p of pearls) { p.x += dx; p.y += dy; }
    }

    return { nodes, edges, pearls };
  }, [rootId, rootPerson, tree, NODE_W, NODE_H, H_GAP, V_GAP]);

  const { nodes, edges, pearls } = buildLayout();

  // ── Surlignage du chemin de parenté ─────────────────────────────────────────
  // kinSet = nœuds du chemin ; kinPairs = paires adjacentes (segments a↔b) ;
  // kinTrunkParents = parents dont le lien parent→enfant est emprunté (le tronc
  // familial partagé ne porte que l'id du parent). Chemin court → coût négligeable.
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const kinSet = kinPath ? new Set(kinPath) : null;
  const kinPairs = new Set<string>();
  const kinTrunkParents = new Set<string>();
  if (kinPath) {
    for (let i = 1; i < kinPath.length; i++) {
      const u = kinPath[i - 1], v = kinPath[i];
      kinPairs.add(pairKey(u, v));
      for (const r of tree.relationships) {
        if (r.type === 'parent' && ((r.person1Id === u && r.person2Id === v) || (r.person1Id === v && r.person2Id === u))) {
          kinTrunkParents.add(r.person1Id);
        }
      }
    }
  }
  const edgeOnKinPath = (e: Edge): boolean =>
    !!kinPath && (e.a && e.b ? kinPairs.has(pairKey(e.a, e.b)) : e.a ? kinTrunkParents.has(e.a) : false);

  // Generation index per node (0 = oldest row), derived from vertical position.
  // Drives the per-node top colour bar + "GÉN. N" tag, matching FocusTree.
  const rowStep = NODE_H + V_GAP;
  const minNodeY = nodes.length ? Math.min(...nodes.map(n => n.y)) : 0;
  const genOf = (y: number) => Math.max(0, Math.round((y - minNodeY) / rowStep));
  // CANONICAL generation per person (déterministe, indépendante du pivot/focus) —
  // même valeur qu'au tableau de bord et dans FocusTree. La position verticale
  // (genOf) ne sert plus que de repli si une personne isolée n'est pas dans la map.
  const genMap = buildGenerationMap(tree);
  const genAbs = (node: { person: Person; y: number }): number => genMap.get(node.person.id) ?? genOf(node.y);
  // Teintes éclaircies pour AA (≥4.5:1 sur le fond de nœud le plus clair #251828) —
  // mêmes familles de teintes que les anciennes (#5b7fa6/#5b8a6e/#8a5b6e, 3.1–4.2:1).
  const genColorTV = (g: number) =>
    g <= 1 ? 'var(--accent)' : g <= 3 ? '#7fa0c6' : g <= 5 ? '#7fae94' : '#c490a6';

  // ── Repères de génération (vue Complète verticale) ──────────────────────────
  // Une entrée par RANGÉE horizontale de nœuds (y distinct) avec le numéro de
  // génération canonique du premier nœud de la rangée. Rendus en screen-space
  // sur le bord gauche, alignés sur les bandes — ils suivent le pan vertical
  // mais restent lisibles à gauche quel que soit le pan horizontal.
  const genRows = (() => {
    const map = new Map<number, number>();
    for (const n of nodes) {
      const key = Math.round(n.y);
      if (!map.has(key)) map.set(key, genAbs(n));
    }
    return [...map.entries()].map(([y, g]) => ({ y, g }));
  })();

  // ---- Fan chart (ancestor pedigree) layout ----
  const MAX_FAN_GEN = 4;
  const FAN_R0 = 54;
  const FAN_RING = 70;
  const fanGenColor = (gen: number) => taupeScale(MAX_FAN_GEN <= 0 ? 1 : 1 - gen / MAX_FAN_GEN);
  const buildFan = useCallback(() => {
    interface Slot { person: Person; gen: number; index: number; }
    const slots: Slot[] = [];
    const visited = new Set<string>();
    function walk(personId: string, gen: number, index: number) {
      const person = tree.persons.find(p => p.id === personId);
      if (!person || visited.has(personId)) return;
      visited.add(personId);
      slots.push({ person, gen, index });
      if (gen >= MAX_FAN_GEN) return;
      const parents = getParents(personId, tree.relationships, tree.persons);
      let father = parents.find(p => p.gender === 'male');
      let mother = parents.find(p => p.gender === 'female');
      const rest = parents.filter(p => p.id !== father?.id && p.id !== mother?.id);
      if (!father) father = rest.shift();
      if (!mother) mother = rest.shift();
      if (father) walk(father.id, gen + 1, index * 2);
      if (mother) walk(mother.id, gen + 1, index * 2 + 1);
    }
    if (rootId) walk(rootId, 0, 0);
    const maxGen = slots.reduce((m, s) => Math.max(m, s.gen), 0);
    const R = FAN_R0 + maxGen * FAN_RING;
    return { slots, maxGen, R };
  }, [rootId, tree]);

  const fan = layoutMode === 'fan' ? buildFan() : null;

  // Content bounds (for the minimap only).
  const minX = nodes.length ? Math.min(...nodes.map(n => n.x)) - 40 : -200;
  const maxX = nodes.length ? Math.max(...nodes.map(n => n.x)) + NODE_W + 40 : 200;
  const minY = nodes.length ? Math.min(...nodes.map(n => n.y)) - 40 : -150;
  const maxY = nodes.length ? Math.max(...nodes.map(n => n.y)) + NODE_H + 40 : 150;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  // ── Virtualisation par viewport (perf grands arbres) ────────────────────────
  // Seuls les nœuds/connecteurs intersectant le viewport ±VIRT_BUFFER px sont
  // MONTÉS dans le DOM — le coût du premier rendu et des pans/zooms devient
  // proportionnel à ce qui est visible, pas à la taille de l'arbre. Le canvas
  // est transformé (translate+scale), pas scrollé : aucun placeholder n'est
  // nécessaire — minimap et fit-to-screen utilisent les bornes complètes
  // (minX/maxX ci-dessus), calculées sur TOUS les nœuds. Le filtrage (O(n) sur
  // des rectangles) se recalcule au rythme des rendus du pan (≤ 1/frame).
  const VIRT_BUFFER = 200;
  const worldRect = (viewport.w > 0 && viewport.h > 0) ? {
    x0: (-VIRT_BUFFER - offset.x) / scale,
    y0: (-VIRT_BUFFER - offset.y) / scale,
    x1: (viewport.w + VIRT_BUFFER - offset.x) / scale,
    y1: (viewport.h + VIRT_BUFFER - offset.y) / scale,
  } : null; // taille encore inconnue → rien n'est monté (mesurée avant le 1er paint ci-dessous)
  const visibleNodes = !worldRect ? [] : nodes.filter(n =>
    (n.x + NODE_W >= worldRect.x0 && n.x <= worldRect.x1
      && n.y + NODE_H >= worldRect.y0 && n.y <= worldRect.y1)
    // Le nœud sélectionné reste monté même hors champ (son anneau/ombre sert de
    // repère au retour, et le focus clavier n'est jamais démonté sous l'utilisateur).
    || n.person.id === selectedPersonId
    // Idem pour la cible de la navigation clavier : elle doit exister dans le DOM
    // pour recevoir le focus() posé après rendu.
    || n.person.id === kbFocusId);
  // Connecteurs : garder ceux dont la bbox coupe le viewport — y compris ceux qui
  // le TRAVERSENT alors que leurs deux extrémités sont hors champ.
  const visibleEdges = !worldRect ? [] : edges.filter(e =>
    Math.max(e.x1, e.x2) >= worldRect.x0 && Math.min(e.x1, e.x2) <= worldRect.x1
    && Math.max(e.y1, e.y2) >= worldRect.y0 && Math.min(e.y1, e.y2) <= worldRect.y1);
  const visiblePearls = !worldRect ? [] : pearls.filter(p =>
    p.x >= worldRect.x0 && p.x <= worldRect.x1 && p.y >= worldRect.y0 && p.y <= worldRect.y1);

  // Mesure le conteneur AVANT le premier paint du canvas : le tout premier rendu
  // monté est déjà virtualisé (c'est lui le plus coûteux sur un grand arbre).
  // Dépend de treeMode/layoutMode : le conteneur n'existe qu'en vue « Complète »
  // (au mount l'app démarre en Focus → ref null). Le ResizeObserver ci-dessous
  // prend le relais pour les resizes suivants.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el && el.clientWidth > 0) setViewport(v => (v.w === el.clientWidth && v.h === el.clientHeight) ? v : { w: el.clientWidth, h: el.clientHeight });
  }, [treeMode, layoutMode]);

  // L'animation d'entrée ne joue qu'à l'arrivée sur l'arbre / au changement de
  // racine : un nœud qui (ré)apparaît ensuite au pan/zoom monte SANS animation,
  // sinon chaque pan provoquait un pop-in différé (delay jusqu'à 600 ms).
  const [entranceDone, setEntranceDone] = useState(false);
  useEffect(() => {
    setEntranceDone(false);
    const timer = setTimeout(() => setEntranceDone(true), 950);
    return () => clearTimeout(timer);
    // treeMode : l'entrée rejoue quand on BASCULE sur la vue Complète (le timer
    // du mount courait pendant le mode Focus, l'entrée aurait été sautée).
  }, [rootId, treeMode]);

  // Mesure de perf dev-only : durée du commit quand le nombre de nœuds montés change.
  const renderT0 = typeof performance !== 'undefined' ? performance.now() : 0;
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof performance === 'undefined') return;
    console.info(`[tree-render] ${visibleNodes.length}/${nodes.length} nœuds montés · ${(performance.now() - renderT0).toFixed(1)} ms`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes.length, nodes.length]);

  // Screen position of a content point is `offset + scale·point` (inner <g> model),
  // so the root (always at content 0,0) is centred by offset = (cw/2, ch/2).
  const centerOn = (id: string | null) => {
    const el = containerRef.current;
    if (!el || !id) return;
    const node = nodes.find(n => n.person.id === id);
    if (!node) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    if (cw === 0) return;
    setOffset({
      x: cw / 2 - (node.x + NODE_W / 2) * scale,
      y: Math.round(ch * 0.35) - (node.y + NODE_H / 2) * scale, // root at the upper third
    });
  };
  const recenter = () => centerOn(rootId);
  // Latest recenter, so the resize observer (mounted once) never calls a stale one.
  const recenterRef = useRef(recenter);

  // External navigation (e.g. from the command-palette search): re-root + center the
  // tree on the requested person, then clear the one-shot request. Fires at mount when
  // the view switches to the tree, and on each new target while already on the tree.
  // (Placed among the hooks — never after an early return — and inlined rather than
  //  calling pickRoot, which is declared further down.)
  useEffect(() => {
    if (!navTarget) return;
    if (tree.persons.some(p => p.id === navTarget)) {
      setRootId(navTarget);
      setFocusPersonId(navTarget);
      setFocusId(null);
      setTimeout(() => centerOn(navTarget), 120);
    }
    onNavConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTarget]);
  recenterRef.current = recenter;

  // Fit-to-screen: scale + offset so the WHOLE tree fits the viewport with padding.
  // The real cure for wide sibling rows (e.g. TSANA Sébastien's 11 children) running
  // off-screen — one click frames everything instead of manual panning.
  const fitToScreen = () => {
    const el = containerRef.current;
    if (!el || !nodes.length) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    if (cw === 0 || ch === 0) return;
    const pad = 56;
    const s = Math.max(0.2, Math.min((cw - pad) / svgW, (ch - pad) / svgH, 1.6));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setScale(s);
    setOffset({ x: cw / 2 - cx * s, y: ch / 2 - cy * s });
  };

  // Déplace le focus clavier vers un nœud connecté RENDU dans la direction voulue.
  // Haut = parent, bas = enfant, gauche/droite = fratrie + conjoints (le candidat le
  // plus proche horizontalement du bon côté). Recentre puis repose le focus DOM.
  const moveKbFocus = (fromId: string, key: string) => {
    const nodeOf = (id: string) => nodes.find(n => n.person.id === id);
    const cur = nodeOf(fromId);
    if (!cur) return;
    let targetId: string | null = null;
    if (key === 'ArrowUp') {
      targetId = getParents(fromId, tree.relationships, tree.persons).map(p => p.id).find(id => nodeOf(id)) ?? null;
    } else if (key === 'ArrowDown') {
      targetId = getChildren(fromId, tree.relationships, tree.persons).map(p => p.id).find(id => nodeOf(id)) ?? null;
    } else {
      const cands = [
        ...getSiblings(fromId, tree.relationships, tree.persons),
        ...getSpouses(fromId, tree.relationships, tree.persons),
      ]
        .map(p => nodeOf(p.id))
        .filter((n): n is NonNullable<typeof n> => !!n)
        .filter(n => (key === 'ArrowLeft' ? n.x < cur.x : n.x > cur.x))
        .sort((a, b) => Math.abs(a.x - cur.x) - Math.abs(b.x - cur.x));
      targetId = cands[0]?.person.id ?? null;
    }
    if (!targetId) return;
    setKbFocusId(targetId);
    centerOn(targetId);
  };

  // Repose le focus DOM sur la cible clavier une fois le nœud (re)monté — deux
  // rAF pour laisser la virtualisation commit le <g> après le centerOn.
  useEffect(() => {
    if (!kbFocusId) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => { nodeRefs.current.get(kbFocusId)?.focus(); });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [kbFocusId]);

  // Kinship label between a person and the current root, for the hover tooltip.
  const relationToRoot = (id: string): string | null => {
    if (!rootId || id === rootId) return null;
    const path = findRelationPath(rootId, id, tree.relationships, tree.persons);
    if (!path) return null;
    return describeRelation(rootId, id, path, tree.relationships, tree.persons);
  };

  // Centre on root: the root is fixed at content (0,0), so screen-centre = offset.
  // Centre the root once the container has a real size. On a hard refresh the
  // container can report clientWidth/Height = 0 when this runs, which would pin
  // the tree at (0,0). ResizeObserver fires as soon as it gets a real size —
  // more reliable than rAF polling. Root is fixed at content (0,0): place it
  // horizontally centred and at the upper third so children below have room.
  useEffect(() => {
    if (!nodes.length || !rootId) return;
    const root = nodes.find(n => n.person.id === rootId);
    if (!root) return;

    const el = containerRef.current;
    if (!el) return;

    const doCenter = () => {
      const { clientWidth: cw, clientHeight: ch } = el;
      if (cw === 0 || ch === 0) return false;
      setOffset({ x: cw / 2, y: Math.round(ch * 0.35) });
      return true;
    };

    if (doCenter()) return;

    const ro = new ResizeObserver(() => { if (doCenter()) ro.disconnect(); });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, nodes.length]);

  // Track container size for the minimap viewport rectangle. Also re-frame the
  // tree when the AVAILABLE WIDTH changes (PersonPanel open/close, sidebar
  // collapse, window resize) — panning never changes width, so this won't fight
  // the user's pan; it only fires on real layout changes (fixes Bug 1).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let prevW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      setViewport({ w, h });
      if (Math.abs(w - prevW) > 1) { prevW = w; recenterRef.current(); }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // treeMode/layoutMode : le conteneur n'existe qu'en vue « Complète » — au
    // mount (Focus) le ref est null et l'observer ne s'attachait jamais.
  }, [treeMode, layoutMode]);

  // Real-time presence + live cursors on ONE channel: announce self and track
  // the OTHER connected users (with their latest cursor position). Joins only
  // when Supabase is configured AND we have a real (non-guest) user; otherwise
  // stays a no-op and `peers` remains []. The leave function tears the channel
  // down on unmount or when the tree/user changes.
  useEffect(() => {
    if (!collaborationEnabled() || !user || !tree?.id) {
      setPeers([]);
      return;
    }
    const me = {
      id: user.id,
      name: (user.user_metadata?.display_name as string) || user.email || '?',
      color: presenceColor(user.id),
    };
    cursorRef.current = joinTreeCursors(tree.id, me, setPeers);
    return () => {
      cursorRef.current?.leave();
      cursorRef.current = null;
      setPeers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.id, user?.id]);

  // ~1s tick so stale cursors (no event for >3s) fade even without new presence
  // events. Only runs while peers are present (cheap no-op when alone/offline).
  useEffect(() => {
    if (peers.length === 0) return;
    const i = setInterval(() => setCursorTick(n => n + 1), 1000);
    return () => clearInterval(i);
  }, [peers.length]);

  const handleWheel = (e: React.WheelEvent) => {
    if (layoutMode === 'fan') return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.88 : 1.12;
    const newScale = Math.max(0.25, Math.min(2.5, scale * delta));
    setOffset(o => ({
      x: mx - (mx - o.x) * (newScale / scale),
      y: my - (my - o.y) * (newScale / scale),
    }));
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (layoutMode === 'fan') return;
    if (e.button === 0) {
      setIsDragging(true);
      setDragMoved(false);
      clearHoverTimer();
      setHover(null); // hide tooltip while panning
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = Math.abs(e.clientX - (dragStart.x + offset.x));
      const dy = Math.abs(e.clientY - (dragStart.y + offset.y));
      if (dx > 4 || dy > 4) setDragMoved(true);
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
    // Broadcast my cursor in CONTENT space (the same space node x/y live in).
    // Inner <g> is translate(offset)·scale, so content = (screen - offset)/scale.
    // Cursors only exist in the classic vertical layout (the fan view has its own
    // viewBox-based coordinate system — see report). Throttled to ~50ms.
    if (layoutMode !== 'vertical' || !cursorRef.current) return;
    const now = Date.now();
    if (now - lastCursorSentRef.current < 50) return;
    lastCursorSentRef.current = now;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (e.clientX - rect.left - offset.x) / scale;
    const cy = (e.clientY - rect.top - offset.y) / scale;
    cursorRef.current.move(cx, cy, 'vertical');
  };
  const handleMouseUp = () => setIsDragging(false);

  // True while the user is dragging on the minimap (press-and-scrub navigation).
  const mmDragRef = useRef(false);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  // Last 2-finger pinch distance (null when not pinching). Used to zoom around
  // the finger midpoint, mirroring handleWheel's zoom-to-point maths.
  const pinchDistRef = useRef<number | null>(null);
  const touchDist = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    if (layoutMode === 'fan') return;
    // Un nouveau toucher ferme le tooltip d'appui long éventuellement ouvert
    // (le handler du nœud, déclenché avant, a pu armer un nouveau timer — voulu).
    setHover(null);
    if (e.touches.length === 2) {
      // Entering a pinch: stop single-finger panning and seed the distance.
      pinchDistRef.current = touchDist(e);
      lastTouchRef.current = null;
      setDragMoved(true); // suppress the tap-to-select that would otherwise fire
    } else if (e.touches.length === 1) {
      pinchDistRef.current = null;
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setDragMoved(false);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (layoutMode === 'fan') return;
    // 2-finger pinch-to-zoom (around the finger midpoint).
    if (e.touches.length === 2 && pinchDistRef.current !== null) {
      const dist = touchDist(e);
      const prev = pinchDistRef.current;
      if (prev > 0 && dist > 0) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          const newScale = Math.max(0.25, Math.min(2.5, scale * (dist / prev)));
          setOffset(o => ({
            x: mx - (mx - o.x) * (newScale / scale),
            y: my - (my - o.y) * (newScale / scale),
          }));
          setScale(newScale);
        }
      }
      pinchDistRef.current = dist;
      return;
    }
    if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) setDragMoved(true);
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    // Once fewer than 2 fingers remain, the pinch is over.
    if (e.touches.length < 2) pinchDistRef.current = null;
    // If one finger is still down (after lifting the other), re-seed the pan anchor.
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 0) {
      lastTouchRef.current = null;
    }
  };

  const handleNodeClick = (personId: string) => {
    // Un appui long vient d'afficher le tooltip : on avale le click de relâche
    // pour que « appui long = infos » ne devienne pas « ouvrir la fiche ».
    if (longPressShownRef.current) { longPressShownRef.current = false; return; }
    if (!dragMoved && !readOnly) onSelectPerson(personId);
  };

  // Double-click focuses the close family around a person and recenters on them.
  const handleNodeDoubleClick = (personId: string) => {
    if (dragMoved) return;
    setFocusId(personId);
    setTimeout(() => centerOn(personId), 0);
  };

  // Gender palette shared with FocusTree/TreeNode (legend + minimap miniatures):
  // blue = male, rose = female, slate = unknown.
  const genderColor = (g: string) =>
    g === 'male' ? GENDER_BAR.male : g === 'female' ? GENDER_BAR.female : GENDER_BAR.unknown;

  const filteredPersons = showSearch && searchQ
    ? tree.persons.filter(p => getDisplayName(p).toLowerCase().includes(searchQ.toLowerCase()))
    : [];

  // Ids surlignés par la recherche (même matcher que filteredPersons).
  const highlightSet: Set<string> | null = highlightQ
    ? new Set(tree.persons
        .filter(p => getDisplayName(p).toLowerCase().includes(highlightQ.toLowerCase()))
        .map(p => p.id))
    : null;

  function dateLine(p: Person): string {
    const birth = formatYear(p.birthDate);
    const death = formatYear(p.deathDate);
    const prefix = p.gender === 'female' ? t('bornF') : t('bornM');
    if (!p.isAlive) {
      if (birth && death) return `${birth} – ${death}`;
      if (death) return `† ${death}`;
      return birth ? `${prefix} ${birth}` : '';
    }
    if (!birth) return '';
    const age = getAge(p.birthDate, p.deathDate);
    return age !== null ? `${prefix} ${birth} · ${formatAge(age)}` : `${prefix} ${birth}`;
  }

  if (tree.persons.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <Sprout size={52} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
        <h3 style={{ margin: 0 }}>{t('emptyTreeTitle')}</h3>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>{t('emptyTreeSubtitle')}</p>
        {!readOnly && <button onClick={onAddPerson} className="btn btn-primary" style={{ gap: '6px' }}><Plus size={16} aria-hidden="true" /> {t('firstPerson')}</button>}
      </div>
    );
  }

  // Re-root + re-focus + recenter on a person chosen from the toolbar search.
  const pickRoot = (id: string) => {
    setRootId(id);
    setFocusPersonId(id);
    setFocusId(null);
    setShowSearch(false);
    setSearchQ('');
    setTimeout(() => centerOn(id), 120);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tree-view motion (entrance stagger, hover lift, root-change fade).
          All animations are disabled under prefers-reduced-motion. */}
      <style>{`
        .tv-node-inner {
          opacity: 0;
          transform: translateY(8px);
          animation: tvNodeIn 360ms ease forwards;
          transition: transform 160ms ease, filter 160ms ease;
        }
        @keyframes tvNodeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .person-node:hover .tv-node-inner,
        .person-node:focus-visible .tv-node-inner {
          transform: translateY(-2px);
        }
        /* Focus clavier visible sur les <g> SVG : anneau or explicite (le
           focus-ring natif est inégal sur les éléments SVG selon le navigateur)
           + renfort du contour de la carte. */
        .person-node:focus { outline: none; }
        .person-node:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
        .person-node:focus-visible .tv-node-card { stroke: var(--accent); stroke-width: 2.5px; }
        .tv-content-enter {
          animation: tvContentIn 320ms ease forwards;
        }
        @keyframes tvContentIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .tv-presence-avatar {
          opacity: 0;
          transform: scale(0.6);
          animation: tvPresenceIn 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes tvPresenceIn {
          to { opacity: 1; transform: scale(1); }
        }
        /* Live-cursor gliding motion between throttled position updates. */
        .tv-cursor { transition: transform 0.1s linear; }
        @media (prefers-reduced-motion: reduce) {
          .tv-node-inner,
          .tv-content-enter,
          .tv-presence-avatar {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .person-node:hover .tv-node-inner,
          .person-node:focus-visible .tv-node-inner {
            transform: none !important;
            filter: none !important;
          }
          .tv-cursor { transition: none !important; }
        }
      `}</style>
      {/* Toolbar — extracted; wraps on narrow/mobile so no control is clipped */}
      <TreeToolbar
        isMobile={isMobile}
        treeName={tree.name}
        treeMode={treeMode}
        setTreeMode={setTreeMode}
        showSearch={showSearch}
        setShowSearch={setShowSearch}
        searchQ={searchQ}
        setSearchQ={setSearchQ}
        persons={tree.persons}
        filteredPersons={filteredPersons}
        onPickRoot={pickRoot}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        onRecenter={recenter}
        onFitToScreen={fitToScreen}
        scale={scale}
        setScale={setScale}
        showLegend={showLegend}
        setShowLegend={setShowLegend}
        readOnly={readOnly}
        onExport={onExport}
        onAddPerson={onAddPerson}
        onComputePath={computeKin}
        onClearPath={clearKin}
        pathActive={!!kinPath}
        pathNotFound={kinResult === 'notfound'}
        onHighlight={q => setHighlightQ(q || null)}
        highlightActive={!!highlightQ}
      />

      {/* « Focus centré » — 3 generations, larger nodes, side panel via onSelectPerson */}
      {treeMode === 'focus' && rootId && (
        <FocusTree
          tree={tree}
          focusId={focusPersonId || rootId}
          pivotId={rootId}
          selectedPersonId={selectedPersonId}
          onFocus={setFocusPersonId}
          onSelectPerson={(id) => { if (!readOnly) onSelectPerson(id); }}
        />
      )}

      {/* Canvas (vue complète) */}
      {treeMode === 'full' && (
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          cursor: layoutMode === 'fan' ? 'default' : isDragging ? 'grabbing' : 'grab',
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: `${GRID * scale}px ${GRID * scale}px`,
          backgroundPosition: `${offset.x % (GRID * scale)}px ${offset.y % (GRID * scale)}px`,
        }}
        onClick={() => showSearch && setShowSearch(false)}
      >
        {layoutMode === 'fan' && fan && (
          <FanChart fan={fan} fanGenColor={fanGenColor} r0={FAN_R0} ring={FAN_RING}
            selectedPersonId={selectedPersonId} onSelectPerson={onSelectPerson}
            peers={peers} cursorRef={cursorRef} lastCursorSentRef={lastCursorSentRef} />
        )}

        {layoutMode === 'vertical' && (
        <svg className="tree-svg" role="group" aria-label={`${t('canvasAria')} — ${tree.name}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', willChange: 'transform' }}>
          <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
            {/* Root-change fade: re-keying on rootId restarts the opacity-only entrance.
                Opacity only (no transform) so it never fights the pan/zoom transform above. */}
            <g key={rootId} className="tv-content-enter">
            {/* Edge + pearl layer. When focus mode is active, dim it uniformly so the
                focus-set nodes stand out (edges carry no person ids — see report). */}
            <g style={focusSet ? { opacity: 0.15, transition: 'opacity 280ms ease', pointerEvents: 'none' } : { transition: 'opacity 280ms ease' }}>
            {/* Edges (elbow filiation + dashed spouse) — virtualisés */}
            {visibleEdges.map((edge, i) => {
              const isSpouse = edge.type === 'spouse';
              // Union (spouse): thick SOLID terracotta horizontal bar. Filiation
              // (parent): thinner solid ink elbow. Differentiated by weight + colour
              // + the union losange below. SEULE exception au « jamais de pointillé » :
              // une union TERMINÉE (divorce/séparation) est tiretée + atténuée — le
              // trait plein reste réservé aux liens actifs.
              // Segment sur le chemin de parenté calculé → bleu info, plus épais.
              const onKin = edgeOnKinPath(edge);
              // Priorité : chemin de parenté (interaction) > teinte d'union (polygamie)
              // > couleur par défaut (union=accent, filiation=ink).
              const stroke = onKin ? 'var(--info)' : edge.color ? edge.color : isSpouse ? 'var(--accent)' : 'var(--ink)';
              // Une filiation teintée est relevée en opacité (0.6) pour que la teinte
              // d'union ressorte du gris très atténué (0.34) des filiations neutres.
              const opacity = onKin ? 0.95 : isSpouse ? (edge.ended ? 0.5 : 0.75) : edge.color ? 0.6 : 0.34;
              return (
                <line key={i}
                  x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                  stroke={stroke}
                  strokeWidth={onKin ? 3 : isSpouse ? 2.25 : 1.6}
                  strokeLinecap="round"
                  strokeDasharray={isSpouse && edge.ended ? '7 5' : undefined}
                  opacity={opacity}
                />
              );
            })}

            {/* Union marker — a small terracotta losange (◆) centred on each couple's bar.
                Union terminée : losange atténué (gris), assorti au trait tireté. */}
            {visiblePearls.map((p, i) => (
              <rect key={`pearl-${i}`}
                x={p.x - 4} y={p.y - 4} width={8} height={8}
                transform={`rotate(45 ${p.x} ${p.y})`}
                fill="var(--bg-card)" stroke={p.ended ? 'var(--text-muted)' : p.color || 'var(--accent)'} strokeWidth={1.5}
                style={{ pointerEvents: 'none' }} />
            ))}
            </g>{/* /edge+pearl focus layer */}

            {/* Nodes — register-card style (virtualisés : seuls les visibles montent) */}
            {visibleNodes.map((node, index) => {
              const p = node.person;
              const isSelected = p.id === selectedPersonId;
              const isRoot = p.id === rootId;
              const dimmed = !inFocus(p.id);
              // Gender-tinted style (pivot=gold); spouses stay gender-coloured here
              // so gender reads across the whole tree. Robust name lines (Bug 3).
              // Mode passed in (computed once above the map) so each node skips its
              // own <html data-theme> read.
              const st = nodeStyle(p, isRoot, false, nodeMode);
              const { primary, secondary } = nameLines(p, t('unknownNode'));
              // Le genre est aussi DIT (pas seulement la couleur de la barre — 1.4.1),
              // et il l'est même sans date de naissance.
              const genderWord = p.gender === 'female' ? t('genderF') : p.gender === 'male' ? t('genderM') : '';
              const ariaLabel = `${getDisplayName(p).trim() || t('unknownNode')}${genderWord ? `, ${genderWord}` : ''}${p.birthDate ? `, ${p.gender === 'female' ? t('bornF') : t('bornM')} ${t('inYear')} ${formatYear(p.birthDate)}` : ''}`;
              // Cap the stagger delay so big trees don't crawl in. Après l'entrée
              // initiale, plus aucun délai (nœuds remontés par la virtualisation).
              const delay = entranceDone ? 0 : Math.min(index * 50, 600);

              return (
                <g key={p.id}
                  ref={el => {
                    if (el) nodeRefs.current.set(p.id, el);
                    else nodeRefs.current.delete(p.id);
                  }}
                  className="person-node"
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleNodeClick(p.id)}
                  onDoubleClick={() => handleNodeDoubleClick(p.id)}
                  onMouseEnter={(e) => {
                    if (isDragging || dimmed) return;
                    const r = containerRef.current?.getBoundingClientRect();
                    if (!r) return;
                    const pos = { id: p.id, x: e.clientX - r.left, y: e.clientY - r.top };
                    clearHoverTimer();
                    hoverTimerRef.current = setTimeout(() => setHover(pos), 400);
                  }}
                  onMouseLeave={() => { clearHoverTimer(); setHover(h => (h?.id === p.id ? null : h)); }}
                  // Mobile : appui long (500 ms) = tooltip ; tout mouvement (pan) l'annule.
                  onTouchStart={(e) => {
                    if (dimmed) return;
                    const t0 = e.touches[0];
                    const r = containerRef.current?.getBoundingClientRect();
                    if (!t0 || !r) return;
                    const pos = { id: p.id, x: t0.clientX - r.left, y: t0.clientY - r.top };
                    clearLongPress();
                    longPressShownRef.current = false;
                    longPressRef.current = setTimeout(() => { longPressShownRef.current = true; setHover(pos); }, 500);
                  }}
                  onTouchMove={clearLongPress}
                  onTouchEnd={clearLongPress}
                  // Focus clavier : amène le nœud dans le viewport (2.4.7/2.4.3) —
                  // sans ça, tabuler atterrissait sur un nœud hors écran, invisible.
                  onFocus={() => centerOn(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(p.id); return; }
                    // Flèches : navigation entre nœuds connectés (parent/enfant/fratrie-conjoint).
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                      e.preventDefault();
                      e.stopPropagation();
                      moveKbFocus(p.id, e.key);
                    }
                  }}
                  opacity={dimmed ? 0.15 : (p.isAlive ? 1 : 0.72)}
                  style={{
                    cursor: dimmed ? 'default' : 'pointer',
                    pointerEvents: dimmed ? 'none' : 'auto',
                    transition: 'opacity 280ms ease',
                  }}
                >
                  {/* Inner group carries the entrance/hover animation. The OUTER <g>
                      keeps the positioning transform — animating transform there would
                      override placement, so all motion lives on this inner group. */}
                  {/* Une fois l'entrée jouée, durée+délai à 0 : l'animation `forwards`
                      saute directement à son état final (opacity 1) — un nœud remonté
                      par la virtualisation apparaît instantanément, sans re-fade au pan.
                      (PAS animation:'none' : l'opacité de base de .tv-node-inner est 0,
                      c'est l'animation qui révèle — la couper rendrait le nœud invisible.) */}
                  <g className="tv-node-inner" style={entranceDone ? { animationDuration: '0ms', animationDelay: '0ms' } : { animationDelay: `${delay}ms` }}>
                  <clipPath id={`card-${p.id}`}><rect width={NODE_W} height={NODE_H} rx={10} ry={10} /></clipPath>

                  {/* Halo « résultat de recherche » — anneau vert TIRETÉ (distinct du
                      bleu plein du chemin de parenté et de l'or sélection/pivot). */}
                  {highlightSet?.has(p.id) && (
                    <rect x={-6} y={-6} width={NODE_W + 12} height={NODE_H + 12} rx={14} ry={14}
                      fill="none" stroke="var(--success)" strokeWidth={2.5} strokeDasharray="5 4" />
                  )}

                  {/* Halo « chemin de parenté » — anneau bleu info autour des nœuds
                      du chemin calculé (distinct de l'or sélection/pivot). */}
                  {kinSet?.has(p.id) && (
                    <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={13} ry={13}
                      fill="none" stroke="var(--info)" strokeWidth={2.5} />
                  )}

                  {/* Soft underlay (Veillée) — only on the pivot/root and the
                      selected node, to give them depth and lift them off the page
                      without muddying every card. Accent glow for the root. */}
                  {(isRoot || isSelected) && (
                    <rect x={0} y={isRoot ? 4 : 3} width={NODE_W} height={NODE_H} rx={10} ry={10}
                      fill={isRoot ? 'var(--accent)' : 'var(--border-strong)'}
                      opacity={isRoot ? 0.4 : 0.16} />
                  )}

                  {/* Card — gender-tinted face (blue=H, rose=F, gold=pivot). Generation
                      on the top band, state on the outline + crown.
                      Root = 2px gold outline; selected = 2px gold; else thin border. */}
                  <rect className="tv-node-card" width={NODE_W} height={NODE_H} rx={10} ry={10}
                    fill={st.bg}
                    stroke={isSelected || isRoot ? 'var(--accent)' : 'var(--border-strong)'}
                    strokeWidth={isRoot ? 2.5 : isSelected ? 2 : 1.25} />

                  {/* Gender bar (left, 6px) + generation band (top, 3px), clipped to the card */}
                  <g clipPath={`url(#card-${p.id})`}>
                    <rect x={0} y={0} width={SPINE} height={NODE_H} fill={st.bar} />
                    <rect x={SPINE} y={0} width={NODE_W - SPINE} height={3} fill={genColorTV(genAbs(node))} />
                  </g>

                  {/* Photo (si présente) — SVG ne connaît pas object-position : on
                      clippe un <image> dans un cercle et on approxime le cadrage
                      `profilePhotoPosition` via preserveAspectRatio (min/mid/max ≈
                      grille focale 3×3). Absente → rien (rendu texte d'origine). */}
                  {p.profilePhoto && (() => {
                    const AV_R = isMobile ? 13 : 18;
                    const AV_CX = SPINE + (isMobile ? 5 : 8) + AV_R;
                    const AV_CY = NODE_H / 2;
                    const pp = p.profilePhotoPosition;
                    const xa = !pp || (pp.x >= 34 && pp.x <= 66) ? 'xMid' : pp.x < 34 ? 'xMin' : 'xMax';
                    const ya = !pp || (pp.y >= 34 && pp.y <= 66) ? 'YMid' : pp.y < 34 ? 'YMin' : 'YMax';
                    return (
                      <g>
                        <clipPath id={`avatar-${p.id}`}><circle cx={AV_CX} cy={AV_CY} r={AV_R} /></clipPath>
                        <circle cx={AV_CX} cy={AV_CY} r={AV_R} fill="var(--surface-3)" />
                        <image href={p.profilePhoto} x={AV_CX - AV_R} y={AV_CY - AV_R} width={AV_R * 2} height={AV_R * 2}
                          clipPath={`url(#avatar-${p.id})`} preserveAspectRatio={`${xa}${ya} slice`} />
                        <circle cx={AV_CX} cy={AV_CY} r={AV_R} fill="none" stroke="var(--border-strong)" strokeWidth={1} />
                      </g>
                    );
                  })()}

                  {/* Generation tag — top-right (desktop only; mobile cards are too short) */}
                  {!isMobile && (
                    <text x={NODE_W - 9} y={14} textAnchor="end" fontFamily="var(--font-mono)" fontSize={8.5} fontWeight={700}
                      fill={genColorTV(genAbs(node))} opacity={0.9}>
                      {t('genAbbr')} {genAbs(node) + 1}
                    </text>
                  )}

                  {/* Root crown — top-right, left of the generation tag (mirrors FocusTree) */}
                  {isRoot && (
                    <path transform={isMobile ? `translate(${NODE_W - 18}, 5) scale(1.0)` : `translate(${NODE_W - 54}, 5) scale(1.25)`}
                      d="M0 3 L3 7 L6 1.5 L9 7 L12 3 L11 10 L1 10 Z"
                      fill="var(--accent)" stroke="var(--bg-card)" strokeWidth={0.6} />
                  )}

                  {/* Primary name — gender-coloured, bold. Falls back to last name,
                      then "Inconnu·e" (Bug 3). Secondary line only when present. */}
                  {(() => {
                    // Décalage du texte à droite de l'avatar quand une photo est présente
                    // (sinon rendu d'origine inchangé) ; on resserre un peu la troncature.
                    const hasPhoto = !!p.profilePhoto;
                    const AV_R = isMobile ? 13 : 18;
                    const tx = hasPhoto
                      ? SPINE + (isMobile ? 5 : 8) + AV_R * 2 + (isMobile ? 6 : 10)
                      : SPINE + (isMobile ? 9 : 14);
                    const maxP = (isMobile ? 13 : 18) - (hasPhoto ? (isMobile ? 4 : 5) : 0);
                    const maxS = (isMobile ? 15 : 20) - (hasPhoto ? (isMobile ? 4 : 5) : 0);
                    const pTrunc = primary.length > maxP ? primary.slice(0, maxP - 1) + '…' : primary;
                    const sTrunc = secondary && secondary.length > maxS ? secondary.slice(0, maxS - 1) + '…' : secondary;
                    const dl = dateLine(p);
                    const nick = (p.nickName || '').trim();

                    // ── With a nickname: NOM / Prénom / « surnom » (italique, discret) +
                    //    date éventuelle. On centre une pile de 2 à 4 lignes pour tenir dans
                    //    la hauteur fixe du nœud (desktop 90 / mobile 64). Sans surnom, on
                    //    garde EXACTEMENT le rendu d'origine (2-3 lignes) — inchangé.
                    if (nick) {
                      const nickFont = isMobile ? 9 : 11;                 // ≈ 0.8em du nom
                      const nTrunc = nick.length > maxS ? nick.slice(0, maxS - 1) + '…' : nick;
                      const lines: { text: string; font: number; weight: number; fill: string; italic?: boolean; mono?: boolean }[] = [
                        { text: pTrunc, font: dims.FONT_NAME, weight: 700, fill: st.name },
                        ...(sTrunc ? [{ text: sTrunc, font: dims.FONT_LAST, weight: 500, fill: 'var(--text-muted)' }] : []),
                        { text: nTrunc, font: nickFont, weight: 400, fill: 'var(--text-light)', italic: true },
                        ...(dl ? [{ text: dl, font: dims.FONT_DATE, weight: 400, fill: 'var(--accent-text)', mono: true }] : []),
                      ];
                      const step = isMobile ? 12 : 15;
                      const startY = NODE_H / 2 - ((lines.length - 1) * step) / 2 + (isMobile ? 3 : 4);
                      return (
                        <>
                          {lines.map((ln, i) => (
                            <text key={i} x={tx} y={startY + i * step}
                              fontFamily={ln.mono ? 'var(--font-mono)' : 'var(--font-body)'}
                              fontSize={ln.font} fontWeight={ln.weight} fill={ln.fill}
                              fontStyle={ln.italic ? 'italic' : undefined}>{ln.text}</text>
                          ))}
                        </>
                      );
                    }

                    // Centre the text block: 3 lines when a secondary exists, else 2.
                    const nameY = sTrunc ? NODE_H / 2 + (isMobile ? -9 : -12) : NODE_H / 2 + (isMobile ? -3 : -5);
                    const dateY = sTrunc ? NODE_H / 2 + (isMobile ? 16 : 22) : NODE_H / 2 + (isMobile ? 12 : 14);
                    return (
                      <>
                        <text x={tx} y={nameY} fontFamily="var(--font-body)" fontSize={dims.FONT_NAME} fontWeight={700} fill={st.name}>{pTrunc}</text>
                        {sTrunc && (
                          <text x={tx} y={NODE_H / 2 + (isMobile ? 4 : 5)} fontFamily="var(--font-body)" fontSize={dims.FONT_LAST} fontWeight={500} fill="var(--text-muted)">{sTrunc}</text>
                        )}
                        {dl && (
                          <text x={tx} y={dateY} fontFamily="var(--font-mono)" fontSize={dims.FONT_DATE} fill="var(--accent-text)">{dl}</text>
                        )}
                      </>
                    );
                  })()}

                  {/* Corner indicator badges (photos / completeness / sources) */}
                  <NodeBadges person={p} labels={{ photos: t('badgePhotos'), complete: t('badgeComplete'), sources: t('badgeSources') }} dims={dims} />
                  </g>
                </g>
              );
            })}

            {/* Live collaborator cursors — rendered in CONTENT space (same <g> as
                the nodes), so a cursor at content (x,y) lands in the right place
                for every viewer regardless of their own pan/zoom. Only peers seen
                in the last 3s are shown; the ~1s tick re-evaluates so idle cursors
                fade out. Self is already excluded by the lib. pointerEvents:none so
                cursors never intercept clicks/drags on the canvas below. */}
            {peers.map(peer => {
              // Only show peers broadcasting in the vertical layout here; fan-layout
              // peers carry SVG-viewBox coordinates that don't map to content space.
              if (peer.layout === 'fan') return null;
              if (peer.x === undefined || peer.y === undefined) return null;
              if (!peer.t || Date.now() - peer.t > 3000) return null;
              const labelW = peer.name.length * 7 + 8;
              return (
                <g key={peer.id} className="tv-cursor"
                  transform={`translate(${peer.x}, ${peer.y})`}
                  style={{ pointerEvents: 'none' }}>
                  <path d="M0 0 L0 16 L4 12 L8 18 L10 16 L6 10 L12 10 Z"
                    fill={peer.color} stroke="white" strokeWidth={1} />
                  <rect x={14} y={-2} width={labelW} height={18} rx={3} fill={peer.color} />
                  <text x={18} y={11} fill="white" fontSize={11} fontFamily="var(--font-mono)">
                    {peer.name}
                  </text>
                </g>
              );
            })}
            </g>{/* /tv-content-enter (root-change fade) */}
          </g>

          {/* Repères de génération — screen-space (hors du <g> pan/zoomé) : petits
              labels mono discrets sur le bord gauche, alignés verticalement sur
              chaque bande de génération, dans la couleur de génération partagée. */}
          <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
            {genRows.map(({ y, g }) => {
              const sy = offset.y + scale * (y + NODE_H / 2);
              if (sy < 14 || sy > viewport.h - 8) return null;
              return (
                <text key={y} x={10} y={sy} dominantBaseline="middle"
                  fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={700}
                  letterSpacing="0.08em" fill={genColorTV(g)} opacity={0.75}>
                  {t('genAbbr')} {g + 1}
                </text>
              );
            })}
          </g>
        </svg>
        )}

        {/* Rich hover tooltip (Atelier: ink card, mono, hard accent shadow). Floats
            above the pointer; pointer-events:none so it never blocks the node beneath.
            Only in the vertical layout and never while panning. */}
        {hover && layoutMode === 'vertical' && !isDragging && (() => {
          const hp = tree.persons.find(pp => pp.id === hover.id);
          if (!hp) return null;
          const place = [hp.birthPlace?.city, hp.birthPlace?.country].filter(Boolean).join(', ');
          const deathPlace = !hp.isAlive ? [hp.deathPlace?.city, hp.deathPlace?.country].filter(Boolean).join(', ') : '';
          // 1-2 événements clés (hors naissance/décès, déjà portés par dates/lieux).
          const KNOWN_EVT = new Set(['birth', 'death', 'marriage', 'divorce', 'baptism', 'graduation', 'military', 'immigration', 'other']);
          const evtLabel = (type: string) => KNOWN_EVT.has(type) ? tp(`event_${type}`) : (type.charAt(0).toUpperCase() + type.slice(1));
          const keyEvents = (hp.events || [])
            .filter(ev => ev.type !== 'birth' && ev.type !== 'death' && (ev.date || ev.description))
            .slice(0, 2);
          const childCount = getChildren(hp.id, tree.relationships, tree.persons).length;
          const kin = relationToRoot(hp.id);
          const dl = dateLine(hp);
          return (
            <div style={{
              position: 'absolute', left: hover.x, top: hover.y,
              transform: 'translate(-50%, calc(-100% - 16px))',
              maxWidth: '260px', zIndex: 'var(--z-dropdown)', pointerEvents: 'none',
              background: 'var(--ink)', color: 'var(--bg)',
              padding: '9px 12px', boxShadow: '3px 3px 0 var(--accent)',
              fontFamily: 'var(--font-mono)', fontSize: '11px', lineHeight: 1.5,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', marginBottom: '3px' }}>
                {getDisplayName(hp)}
              </div>
              {dl && <div style={{ opacity: 0.85 }}>{dl}</div>}
              {place && <div style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} aria-hidden="true" /> {place}</div>}
              {deathPlace && <div style={{ opacity: 0.85 }}>† {deathPlace}</div>}
              {keyEvents.map(ev => (
                <div key={ev.id} style={{ opacity: 0.85 }}>
                  {evtLabel(ev.type)}{ev.date ? ` · ${formatYear(ev.date)}` : ''}
                </div>
              ))}
              <div style={{ opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {hp.id === rootId && <Crown size={11} aria-hidden="true" />}
                <span>
                  {hp.id === rootId ? t('origin') : kin ? kin : ''}
                  {childCount > 0 ? `${hp.id === rootId || kin ? ' · ' : ''}${childCount} ${childCount > 1 ? t('children') : t('child')}` : ''}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Chip du surlignage de recherche — requête + nombre de correspondances */}
        {highlightQ && highlightSet && layoutMode === 'vertical' && (
          <div role="status" style={{
            position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 'var(--z-dropdown)', display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--bg-card)', border: '1px solid var(--success)',
            padding: '5px 10px', boxShadow: 'var(--shadow)', fontSize: '12px', color: 'var(--text-muted)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>
              « {highlightQ} »
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{t('highlightCount', { n: highlightSet.size })}</span>
            <button onClick={() => setHighlightQ(null)} className="btn btn-secondary btn-sm btn-icon"
              aria-label={t('highlightClear')} title={t('highlightClear')} style={{ minHeight: '24px' }}>
              ×
            </button>
          </div>
        )}

        {/* Bannière du chemin de parenté calculé — nom A ↔ nom B, lien nommé + étapes */}
        {kinPath && kinResult && kinResult !== 'notfound' && layoutMode === 'vertical' && (() => {
          const pa = tree.persons.find(pp => pp.id === kinPath[0]);
          const pb = tree.persons.find(pp => pp.id === kinPath[kinPath.length - 1]);
          if (!pa || !pb) return null;
          return (
            <div role="status" style={{
              position: 'absolute', top: '12px', left: '12px', zIndex: 'var(--z-dropdown)',
              display: 'flex', alignItems: 'center', gap: '10px', maxWidth: 'calc(100% - 140px)',
              background: 'var(--bg-card)', border: '1px solid var(--info)',
              padding: '6px 10px', boxShadow: 'var(--shadow)', fontSize: '12px', color: 'var(--text-muted)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--info)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getDisplayName(pa)} ↔ {getDisplayName(pb)}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{kinResult.label} · {t('pathSteps', { n: kinResult.steps })}</span>
              <button onClick={clearKin} className="btn btn-secondary btn-sm">{t('pathClear')}</button>
            </div>
          );
        })()}

        {/* Focus mode: floating "full view" escape, shown only while focused */}
        {focusId && layoutMode === 'vertical' && (
          <button
            onClick={() => setFocusId(null)}
            className="btn btn-secondary btn-sm"
            style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 'var(--z-dropdown)', boxShadow: 'var(--shadow)' }}
          >
            {t('fullView')}
          </button>
        )}

        {/* Legend — minimalist, hidden by default */}
        {showLegend && (
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', maxWidth: '140px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', fontSize: '11px', color: 'var(--text-muted)', boxShadow: 'var(--shadow)' }}>
            <div className="label" style={{ marginBottom: '8px', color: 'var(--text)' }}>{t('legend')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '6px', height: '14px', background: '#4A90D9', flexShrink: 0 }} /> {t('male')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '6px', height: '14px', background: '#C47BA0', flexShrink: 0 }} /> {t('female')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '6px', height: '14px', background: 'var(--accent)', flexShrink: 0 }} /> {t('origin')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="26" y2="4" stroke="var(--ink)" strokeWidth="1.6" opacity="0.34" /></svg> {t('filiation')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="10" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="5" x2="26" y2="5" stroke="var(--accent)" strokeWidth="2.25" opacity="0.75" />
                  <rect x="10" y="2" width="6" height="6" transform="rotate(45 13 5)" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="1.2" />
                </svg> {t('union')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="10" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="5" x2="26" y2="5" stroke="var(--accent)" strokeWidth="2.25" strokeDasharray="5 4" opacity="0.5" />
                  <rect x="10" y="2" width="6" height="6" transform="rotate(45 13 5)" fill="var(--bg-card)" stroke="var(--text-muted)" strokeWidth="1.2" />
                </svg> {t('unionEnded')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="26" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="13" y2="4" stroke={unionTint(0)} strokeWidth="1.8" opacity="0.7" />
                  <line x1="13" y1="4" x2="26" y2="4" stroke={unionTint(1)} strokeWidth="1.8" opacity="0.7" />
                </svg> {t('multiUnionLegend')}
              </div>
            </div>
          </div>
        )}

        {/* Node count — accent figures, soft outline (Veillée) */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg-card)', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)', padding: '4px 13px', fontSize: '12px', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}>
          <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{nodes.length}</strong>
          <span style={{ opacity: 0.6 }}> / {tree.persons.length}</span> {t('persons')}
        </div>

        {/* Real-time presence: overlapping avatar cluster + counter. Rendered only
            when at least one OTHER user is connected (so never shows when alone).
            Driven by the same `peers` state that powers the live cursors. */}
        {peers.length > 0 && (
          <div
            aria-live="polite"
            style={{
              position: 'absolute', top: '48px', right: '12px', zIndex: 'var(--z-dropdown)',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--bg-card)', border: 'var(--bw, 1px) solid var(--border-strong, var(--border))',
              borderRadius: 'var(--radius-full)', padding: '4px 12px 4px 8px',
              boxShadow: 'var(--shadow)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center' }}>
              {peers.slice(0, 4).map((u, i) => (
                <span
                  key={u.id}
                  className="tv-presence-avatar"
                  title={u.name}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: u.color || presenceColor(u.id), color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-display)',
                    border: '2px solid var(--bg-card)',
                    marginRight: i === 0 ? 0 : '-9px',
                    animationDelay: `${(Math.min(peers.length, 4) - 1 - i) * 60}ms`,
                  }}
                >
                  {(u.name?.[0] || '?').toUpperCase()}
                </span>
              ))}
              {peers.length > 4 && (
                <span
                  className="tv-presence-avatar"
                  title={peers.slice(4).map(u => u.name).join(', ')}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'var(--text-muted)', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    border: '2px solid var(--bg-card)', marginRight: '-9px',
                  }}
                >
                  +{peers.length - 4}
                </span>
              )}
            </div>
            <span className="label" style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {tc('presence', { count: peers.length + 1 })}
            </span>
          </div>
        )}

        {/* Minimap */}
        {layoutMode === 'vertical' && nodes.length > 0 && (() => {
          const MM_W = 140, MM_H = 88;
          const mmScale = Math.min(MM_W / svgW, MM_H / svgH);
          const drawW = svgW * mmScale, drawH = svgH * mmScale;
          const padX = (MM_W - drawW) / 2, padY = (MM_H - drawH) / 2;
          const cw = viewport.w, ch = viewport.h;
          const vx = padX + (-offset.x / scale - minX) * mmScale;
          const vy = padY + (-offset.y / scale - minY) * mmScale;
          const vw = (cw / scale) * mmScale;
          const vh = (ch / scale) * mmScale;
          const navigate = (clientX: number, clientY: number, rect: DOMRect) => {
            const cx = minX + (clientX - rect.left - padX) / mmScale;
            const cy = minY + (clientY - rect.top - padY) / mmScale;
            setOffset({ x: cw / 2 - scale * cx, y: ch / 2 - scale * cy });
          };
          return (
            <div
              onMouseDown={e => { e.stopPropagation(); mmDragRef.current = true; navigate(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); }}
              onMouseMove={e => { if (mmDragRef.current) navigate(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect()); }}
              onMouseUp={() => { mmDragRef.current = false; }}
              onMouseLeave={() => { mmDragRef.current = false; }}
              onClick={e => e.stopPropagation()}
              title={t('clickToNavigate')}
              style={{ position: 'absolute', bottom: '12px', right: '12px', width: `${MM_W}px`, height: `${MM_H}px`, background: 'var(--bg-card)', border: 'var(--bw) solid var(--border-strong)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', cursor: 'crosshair' }}>
              <svg width={MM_W} height={MM_H} style={{ display: 'block' }}>
                {nodes.map(n => {
                  const active = n.person.id === selectedPersonId || n.person.id === rootId;
                  // Miniatures coloured by role/gender so the minimap echoes the canvas.
                  const fill = active ? 'var(--accent)' : genderColor(n.person.gender);
                  return (
                    <rect key={n.person.id}
                      x={padX + (n.x - minX) * mmScale} y={padY + (n.y - minY) * mmScale}
                      width={6} height={3.5} rx={1}
                      fill={fill} opacity={active ? 1 : 0.7} />
                  );
                })}
                <rect x={vx} y={vy} width={vw} height={vh} fill="var(--accent)" fillOpacity={0.1} stroke="var(--accent)" strokeWidth={1.4} rx={2} />
              </svg>
              <div className="label" style={{ position: 'absolute', top: '3px', left: '6px', fontSize: '9px', pointerEvents: 'none' }}>{t('minimap')}</div>
            </div>
          );
        })()}
      </div>
      )}
    </div>
  );
}

// ===== Fan chart (ancestor pedigree, pure SVG, auto-fit) =====
interface FanData { slots: { person: Person; gen: number; index: number }[]; maxGen: number; R: number; }

function FanChart({ fan, fanGenColor, r0, ring, selectedPersonId, onSelectPerson, peers, cursorRef, lastCursorSentRef }: {
  fan: FanData;
  fanGenColor: (gen: number) => string;
  r0: number;
  ring: number;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  peers: CursorPeer[];
  cursorRef: React.RefObject<{ move: (x: number, y: number, layout?: 'vertical' | 'fan') => void; leave: () => void } | null>;
  lastCursorSentRef: React.RefObject<number>;
}) {
  const t = useTranslations('tree');
  // Ref to this fan <svg> so screen→fan-SVG coords can be derived via its CTM.
  // Fan coordinates live in the centered viewBox space (origin at the fan centre);
  // getScreenCTM().inverse() yields exactly that, so a peer's translate(x,y) lands
  // identically for every viewer regardless of container size (preserveAspectRatio).
  const fanSvgRef = useRef<SVGSVGElement>(null);
  const pad = 32;
  const view = fan.R + pad;

  // Broadcast my cursor in fan-SVG space. Throttled (~50ms) via the SAME ref the
  // vertical handler uses, so the two layouts can't double-fire within a frame.
  const handleFanMouseMove = (e: React.MouseEvent) => {
    if (!cursorRef.current) return;
    const now = Date.now();
    if (now - lastCursorSentRef.current < 50) return;
    lastCursorSentRef.current = now;
    const el = fanSvgRef.current;
    if (!el) return;
    const ptScreen = el.createSVGPoint();
    ptScreen.x = e.clientX;
    ptScreen.y = e.clientY;
    const m = el.getScreenCTM();
    if (!m) return;
    const p = ptScreen.matrixTransform(m.inverse());
    cursorRef.current.move(p.x, p.y, 'fan');
  };
  const ang = (a: number) => -Math.PI / 2 + a;
  const pt = (r: number, a: number): [number, number] => [r * Math.cos(ang(a)), r * Math.sin(ang(a))];

  function annular(rInner: number, rOuter: number, a0: number, a1: number): string {
    const [xo0, yo0] = pt(rOuter, a0);
    const [xo1, yo1] = pt(rOuter, a1);
    const [xi1, yi1] = pt(rInner, a1);
    const [xi0, yi0] = pt(rInner, a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${xo0.toFixed(2)} ${yo0.toFixed(2)} A ${rOuter} ${rOuter} 0 ${large} 1 ${xo1.toFixed(2)} ${yo1.toFixed(2)} L ${xi1.toFixed(2)} ${yi1.toFixed(2)} A ${rInner} ${rInner} 0 ${large} 0 ${xi0.toFixed(2)} ${yi0.toFixed(2)} Z`;
  }

  const root = fan.slots.find(s => s.gen === 0);

  return (
    <svg ref={fanSvgRef} onMouseMove={handleFanMouseMove}
      role="group" aria-label={t('fanAria')}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox={`${-view} ${-view} ${view * 2} ${view * 2}`} preserveAspectRatio="xMidYMid meet">
      {fan.slots.filter(s => s.gen >= 1).map(s => {
        const slotAngle = (Math.PI * 2) / Math.pow(2, s.gen);
        const a0 = s.index * slotAngle;
        const a1 = a0 + slotAngle;
        const rInner = r0 + (s.gen - 1) * ring;
        const rOuter = rInner + ring;
        const mid = (a0 + a1) / 2;
        const [tx, ty] = pt((rInner + rOuter) / 2, mid);
        let rot = ang(mid) * 180 / Math.PI;
        if (rot > 90 || rot < -90) rot += 180;
        const isSel = s.person.id === selectedPersonId;
        const maxChars = s.gen <= 1 ? 12 : s.gen === 2 ? 9 : 7;
        const fontSize = s.gen <= 1 ? 12 : s.gen === 2 ? 10 : 8.5;
        const label = s.person.firstName.length > maxChars ? s.person.firstName.slice(0, maxChars - 1) + '…' : s.person.firstName;
        return (
          <g key={s.person.id} role="button" tabIndex={0} className="fan-slot"
            aria-label={`${s.person.firstName} ${s.person.lastName}`}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectPerson(s.person.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPerson(s.person.id); } }}>
            <path d={annular(rInner, rOuter, a0, a1)}
              fill={fanGenColor(s.gen)} fillOpacity={isSel ? 0.95 : 0.82}
              stroke={isSel ? 'var(--accent)' : 'var(--bg-card)'} strokeWidth={isSel ? 3 : 1.5} />
            <text x={tx} y={ty} transform={`rotate(${rot.toFixed(1)} ${tx.toFixed(2)} ${ty.toFixed(2)})`}
              textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={600}
              fontFamily="var(--font-body)" fill="#1a1714" style={{ pointerEvents: 'none' }}>
              {label}
            </text>
          </g>
        );
      })}

      {root && (
        <g role="button" tabIndex={0} className="fan-slot"
          aria-label={`${root.person.firstName} ${root.person.lastName}`}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectPerson(root.person.id)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPerson(root.person.id); } }}>
          <circle cx={0} cy={0} r={r0} fill={taupeScale(0.5)} stroke="var(--accent)" strokeWidth={root.person.id === selectedPersonId ? 3 : 2} />
          <text x={0} y={-6} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fontFamily="var(--font-display)" fill="#1a1714" style={{ pointerEvents: 'none' }}>
            {root.person.firstName.length > 12 ? root.person.firstName.slice(0, 11) + '…' : root.person.firstName}
          </text>
          <text x={0} y={12} textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily="var(--font-body)" fill="#1a1714" fillOpacity={0.85} style={{ pointerEvents: 'none' }}>
            {root.person.lastName.length > 13 ? root.person.lastName.slice(0, 12) + '…' : root.person.lastName}
          </text>
        </g>
      )}

      {fan.maxGen === 0 && (
        <text x={0} y={r0 + 30} textAnchor="middle" fontSize={13} fontFamily="var(--font-body)" fill="var(--text-muted)">
          {t('noAncestors')}
        </text>
      )}

      {/* Live collaborator cursors in fan-SVG space — only peers broadcasting the
          fan layout, seen in the last 3s. Same arrow + mono name badge as the
          vertical cursors; the .tv-cursor class also picks up the reduced-motion
          rule. pointerEvents:none so they never intercept fan slot clicks. */}
      {peers.map(peer => {
        if (peer.layout !== 'fan') return null;
        if (peer.x === undefined || peer.y === undefined) return null;
        if (!peer.t || Date.now() - peer.t > 3000) return null;
        const labelW = peer.name.length * 7 + 8;
        return (
          <g key={peer.id} className="tv-cursor"
            transform={`translate(${peer.x}, ${peer.y})`}
            style={{ pointerEvents: 'none' }}>
            <path d="M0 0 L0 16 L4 12 L8 18 L10 16 L6 10 L12 10 Z"
              fill={peer.color} stroke="white" strokeWidth={1} />
            <rect x={14} y={-2} width={labelW} height={18} rx={3} fill={peer.color} />
            <text x={18} y={11} fill="white" fontSize={11} fontFamily="var(--font-mono)">
              {peer.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
