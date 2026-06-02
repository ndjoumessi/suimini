'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getDisplayName, formatYear, getAge } from '@/lib/treeUtils';
import { Search, ZoomIn, ZoomOut, Crosshair, Info, Plus, Aperture, Crown, Cross, Sprout } from 'lucide-react';

/** Two-letter initials for the avatar fallback (same logic as PersonPanel/Sidebar). */
function nodeInitials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
}

/**
 * Monochrome WARM-NEUTRAL ramp, used ONLY by the fan chart so its concentric
 * ancestor rings stay distinguishable. The vertical tree no longer colours nodes
 * by generation: generation is read by vertical POSITION, and the cuir-taupe
 * accent is reserved for root / selection (Rare Accent Rule, DESIGN.md).
 */
function taupeScale(t: number): string {
  const a = [211, 204, 192]; // #d3ccc0 (warm light neutral)
  const b = [132, 124, 112]; // #847c70 (warm grey / --text-light)
  const k = Math.max(0, Math.min(1, t));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

interface TreeNode {
  person: Person;
  x: number;
  y: number;
  generation: number;
}

interface Edge { x1: number; y1: number; x2: number; y2: number; type: string; }
interface Heart { x: number; y: number; }

interface Props {
  tree: FamilyTree;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
}

// Larger, more legible nodes (see DESIGN.md "Tree node (signature)").
const NODE_W = 200;
const NODE_H = 96;
const H_GAP = 56;
const V_GAP = 96;

export default function TreeView({ tree, selectedPersonId, onSelectPerson, onAddPerson }: Props) {
  const [rootId, setRootId] = useState(tree.rootPersonId || tree.persons[0]?.id || null);
  const [scale, setScale] = useState(0.9);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMoved, setDragMoved] = useState(false); // distinguish click vs drag
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showLegend, setShowLegend] = useState(false); // discreet by default
  const [viewport, setViewport] = useState({ w: 0, h: 0 }); // container size, for the minimap
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'fan'>('vertical');

  const rootPerson = tree.persons.find(p => p.id === rootId);

  const buildLayout = useCallback(() => {
    if (!rootId || !rootPerson) return { nodes: [] as TreeNode[], edges: [] as Edge[], hearts: [] as Heart[] };
    const nodes: TreeNode[] = [];
    const edges: Edge[] = [];
    const hearts: Heart[] = [];
    const visited = new Set<string>();

    function placeFamily(personId: string, genY: number, centerX: number) {
      if (visited.has(personId)) return;
      visited.add(personId);
      const person = tree.persons.find(p => p.id === personId);
      if (!person) return;

      const spouses = getSpouses(personId, tree.relationships, tree.persons).filter(s => !visited.has(s.id));

      // Couple-centred layout: the whole couple row is centred on `centerX`, so the
      // children hang from the midpoint between the partners (where the ♥ sits).
      const unit = 1 + spouses.length;
      const rowW = unit * NODE_W + (unit - 1) * H_GAP;
      const mainX = centerX - rowW / 2;

      nodes.push({ person, x: mainX, y: genY, generation: 0 });
      let prevNodeX = mainX;

      spouses.forEach(spouse => {
        visited.add(spouse.id);
        const sx = prevNodeX + NODE_W + H_GAP;
        nodes.push({ person: spouse, x: sx, y: genY, generation: 0 });
        const lineY = genY + NODE_H / 2;
        // Partner link + heart marker at the gap centre
        edges.push({ x1: prevNodeX + NODE_W, y1: lineY, x2: sx, y2: lineY, type: 'spouse' });
        hearts.push({ x: prevNodeX + NODE_W + H_GAP / 2, y: lineY });
        prevNodeX = sx;
      });

      const coupleMidX = centerX; // row centred on centerX → couple midpoint = centerX

      // Children descend from the couple midpoint via a single trunk + bus.
      const children = getChildren(personId, tree.relationships, tree.persons);
      if (children.length > 0) {
        const childY = genY + NODE_H + V_GAP;
        const childTotalW = children.length * (NODE_W + H_GAP) - H_GAP;
        const childStartX = coupleMidX - childTotalW / 2;
        const childMidY = genY + NODE_H + V_GAP / 2;
        // For a simple couple the trunk starts at the ♥; otherwise from the row bottom.
        const trunkTopY = spouses.length === 1 ? genY + NODE_H / 2 : genY + NODE_H;

        edges.push({ x1: coupleMidX, y1: trunkTopY, x2: coupleMidX, y2: childMidY, type: 'parent-v' });

        children.forEach((child, i) => {
          const childX = childStartX + i * (NODE_W + H_GAP);
          const childMidX = childX + NODE_W / 2;
          edges.push({ x1: coupleMidX, y1: childMidY, x2: childMidX, y2: childMidY, type: 'parent-h' });
          edges.push({ x1: childMidX, y1: childMidY, x2: childMidX, y2: childY, type: 'parent-v' });
          placeFamily(child.id, childY, childMidX);
        });
      }

      // Parents + grandparents (only for the root person)
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
              nodes.push({ person: parent, x: parentX, y: parentY, generation: 0 });
            }
            edges.push({ x1: parentMidX2, y1: parentY + NODE_H, x2: parentMidX2, y2: midY, type: 'parent-v' });
            edges.push({ x1: parentMidX2, y1: midY, x2: rootMidX, y2: midY, type: 'parent-h' });
            edges.push({ x1: rootMidX, y1: midY, x2: rootMidX, y2: genY, type: 'parent-v' });

            const grandparents = getParents(parent.id, tree.relationships, tree.persons);
            if (grandparents.length > 0) {
              const gpY = parentY - NODE_H - V_GAP;
              grandparents.forEach((gp, j) => {
                const gpX = parentX + (j - (grandparents.length - 1) / 2) * (NODE_W + H_GAP);
                if (!visited.has(gp.id)) {
                  visited.add(gp.id);
                  nodes.push({ person: gp, x: gpX, y: gpY, generation: 0 });
                  edges.push({ x1: gpX + NODE_W / 2, y1: gpY + NODE_H, x2: gpX + NODE_W / 2, y2: parentY - V_GAP / 2, type: 'parent-v' });
                  edges.push({ x1: gpX + NODE_W / 2, y1: parentY - V_GAP / 2, x2: parentMidX2, y2: parentY - V_GAP / 2, type: 'parent-h' });
                  edges.push({ x1: parentMidX2, y1: parentY - V_GAP / 2, x2: parentMidX2, y2: parentY, type: 'parent-v' });
                }
              });
            }
          });

          // Link the two root parents as a couple (♥ between them).
          if (parents.length === 2) {
            const p0Right = parentStartX + NODE_W;
            const p1Left = parentStartX + NODE_W + H_GAP;
            const lineY = parentY + NODE_H / 2;
            edges.push({ x1: p0Right, y1: lineY, x2: p1Left, y2: lineY, type: 'spouse' });
            hearts.push({ x: parentStartX + NODE_W + H_GAP / 2, y: lineY });
          }
        }
      }
    }

    placeFamily(rootId, 0, 0);
    return { nodes, edges, hearts };
  }, [rootId, rootPerson, tree]);

  const { nodes, edges, hearts } = buildLayout();

  // ---- Fan chart (ancestor pedigree) layout ----
  const MAX_FAN_GEN = 4;
  const FAN_R0 = 54;   // central root circle radius
  const FAN_RING = 70; // ring width per generation
  const fanGenColor = (gen: number) => {
    // Monochrome warm ramp, centre (root, newest) → outer (older).
    const t = MAX_FAN_GEN <= 0 ? 1 : 1 - gen / MAX_FAN_GEN;
    return taupeScale(t);
  };
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

  const minX = nodes.length ? Math.min(...nodes.map(n => n.x)) - 60 : -400;
  const maxX = nodes.length ? Math.max(...nodes.map(n => n.x)) + NODE_W + 60 : 400;
  const minY = nodes.length ? Math.min(...nodes.map(n => n.y)) - 60 : -200;
  const maxY = nodes.length ? Math.max(...nodes.map(n => n.y)) + NODE_H + 60 : 400;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  // Screen position of a content point is `offset + scale·(coord − minX/minY)`,
  // because the <svg> viewBox starts at (minX, minY) (both negative). Centring
  // MUST subtract minX/minY — omitting it was the "tree pushed to the right" bug.
  const centerOn = (id: string | null) => {
    const el = containerRef.current;
    if (!el || !id) return;
    const node = nodes.find(n => n.person.id === id);
    if (!node) return;
    const { clientWidth: cw, clientHeight: ch } = el;
    if (cw === 0) return; // container not laid out yet
    setOffset({
      x: cw / 2 - (node.x + NODE_W / 2 - minX) * scale,
      y: ch / 2 - (node.y + NODE_H / 2 - minY) * scale,
    });
  };

  const recenter = () => centerOn(rootId);

  // Centre on root once the nodes exist AND the container has a real width.
  // Depends on `nodes.length` so it fires when the layout is first computed
  // (so clientWidth is already known — the timing half of the original bug).
  // The rAF loop is the ResizeObserver/setTimeout fallback for a 0-width container.
  useEffect(() => {
    if (!nodes.length || !rootId) return;
    const root = nodes.find(n => n.person.id === rootId);
    if (!root) return;
    let raf = 0;
    let tries = 0;
    const attempt = () => {
      const el = containerRef.current;
      if (el && el.clientWidth > 0) {
        const { clientWidth: cw, clientHeight: ch } = el;
        setOffset({
          x: cw / 2 - (root.x + NODE_W / 2 - minX) * scale,
          y: ch / 2 - (root.y + NODE_H / 2 - minY) * scale,
        });
        return;
      }
      if (tries++ < 60) raf = requestAnimationFrame(attempt);
    };
    attempt();
    return () => { if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, nodes.length]);

  // Track container size for the minimap viewport rectangle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (layoutMode === 'fan') return; // fan chart auto-fits; no pan/zoom
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.88 : 1.12;
    const newScale = Math.max(0.25, Math.min(2.5, scale * delta));
    // Zoom toward mouse position
    setOffset(o => ({
      x: mx - (mx - o.x) * (newScale / scale),
      y: my - (my - o.y) * (newScale / scale),
    }));
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (layoutMode === 'fan') return; // fan chart auto-fits; no panning
    if (e.button === 0) {
      setIsDragging(true);
      setDragMoved(false);
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
  };

  const handleMouseUp = () => { setIsDragging(false); };

  // Touch support
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setDragMoved(false);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - lastTouchRef.current.x;
      const dy = e.touches[0].clientY - lastTouchRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) setDragMoved(true);
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleNodeClick = (personId: string) => {
    if (!dragMoved) {
      onSelectPerson(personId);
    }
  };

  const genderColor = (g: string) =>
    g === 'male' ? 'var(--male)' : g === 'female' ? 'var(--female)' : 'var(--text-muted)';

  const filteredPersons = showSearch && searchQ
    ? tree.persons.filter(p => getDisplayName(p).toLowerCase().includes(searchQ.toLowerCase()))
    : [];

  if (tree.persons.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <Sprout size={52} strokeWidth={1.25} style={{ color: 'var(--text-light)' }} aria-hidden="true" />
        <h3 style={{ margin: 0 }}>Cet arbre est vide</h3>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Ajoutez la première personne pour commencer</p>
        <button onClick={onAddPerson} className="btn btn-primary" style={{ gap: '6px' }}><Plus size={16} aria-hidden="true" /> Première personne</button>
      </div>
    );
  }

  const sepStyle: React.CSSProperties = { width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar — grouped: [Racine] | [centrer][zoom][%] | [Fan][Légende] | [+ Ajouter] */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.2rem', flex: 1, minWidth: '100px' }}>
          {tree.name}
        </h2>

        {/* Group: change root */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSearch(!showSearch)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }} aria-label="Changer la racine de l'arbre" aria-expanded={showSearch}>
            <Search size={14} aria-hidden="true" /> Racine
          </button>
          {showSearch && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px', width: '240px', boxShadow: 'var(--shadow-lg)' }}>
              <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Nom de la personne..." className="input" style={{ marginBottom: '6px' }} />
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {(searchQ ? filteredPersons : tree.persons.slice(0, 20)).map(p => (
                  <button key={p.id} onClick={() => { setRootId(p.id); setShowSearch(false); setSearchQ(''); setTimeout(() => centerOn(p.id), 120); }}
                    style={{ width: '100%', padding: '7px 8px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ width: '22px', height: '22px', flexShrink: 0, borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{nodeInitials(p)}</span>
                    <span style={{ flex: 1 }}>{getDisplayName(p)}</span>
                    <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>{formatYear(p.birthDate)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Group: pan / zoom (vertical only) */}
        {layoutMode === 'vertical' && <>
          <div aria-hidden="true" style={sepStyle} />
          <button onClick={recenter} className="btn btn-secondary btn-sm btn-icon" title="Centrer sur la racine" aria-label="Centrer"><Crosshair size={15} aria-hidden="true" /></button>
          <button onClick={() => setScale(s => Math.max(0.25, s * 0.8))} className="btn btn-secondary btn-sm btn-icon" title="Zoom arrière" aria-label="Zoom arrière"><ZoomOut size={15} aria-hidden="true" /></button>
          <button onClick={() => setScale(1)} className="btn btn-secondary btn-sm" style={{ minWidth: '48px' }} title="Réinitialiser le zoom" aria-label="Réinitialiser le zoom">{Math.round(scale * 100)}%</button>
          <button onClick={() => setScale(s => Math.min(2.5, s * 1.2))} className="btn btn-secondary btn-sm btn-icon" title="Zoom avant" aria-label="Zoom avant"><ZoomIn size={15} aria-hidden="true" /></button>
        </>}

        {/* Group: view options */}
        <div aria-hidden="true" style={sepStyle} />
        <button onClick={() => setLayoutMode(m => m === 'fan' ? 'vertical' : 'fan')} className="btn btn-sm" style={{ gap: '6px', background: layoutMode === 'fan' ? 'var(--accent)' : 'var(--bg-muted)', color: layoutMode === 'fan' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }} title="Basculer en éventail (fan chart)" aria-pressed={layoutMode === 'fan'}>
          <Aperture size={14} aria-hidden="true" /> Fan
        </button>
        <button onClick={() => setShowLegend(l => !l)} className="btn btn-secondary btn-sm btn-icon" title="Afficher la légende" aria-label="Légende" aria-pressed={showLegend}>
          <Info size={14} aria-hidden="true" />
        </button>

        {/* Group: primary action */}
        <div aria-hidden="true" style={sepStyle} />
        <button onClick={onAddPerson} className="btn btn-primary btn-sm" style={{ gap: '6px' }}><Plus size={14} aria-hidden="true" /> Ajouter</button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          cursor: layoutMode === 'fan' ? 'default' : isDragging ? 'grabbing' : 'grab',
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: `${28 * scale}px ${28 * scale}px`,
          backgroundPosition: `${offset.x % (28 * scale)}px ${offset.y % (28 * scale)}px`,
        }}
        onClick={() => showSearch && setShowSearch(false)}
      >
        {layoutMode === 'fan' && fan && (
          <FanChart fan={fan} fanGenColor={fanGenColor} r0={FAN_R0} ring={FAN_RING}
            selectedPersonId={selectedPersonId} onSelectPerson={onSelectPerson} />
        )}

        {layoutMode === 'vertical' && (
        <svg
          className="tree-svg"
          style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, overflow: 'visible' }}
          width={svgW} height={svgH}
          viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const isSpouse = edge.type === 'spouse';
            return (
              <line key={i}
                x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                stroke={isSpouse ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={isSpouse ? 2 : 1.5}
                strokeDasharray={isSpouse ? '6,4' : 'none'}
                opacity={isSpouse ? 0.5 : 1}
              />
            );
          })}

          {/* Couple hearts */}
          {hearts.map((h, i) => (
            <g key={`heart-${i}`} style={{ pointerEvents: 'none' }}>
              <circle cx={h.x} cy={h.y} r={9} fill="var(--bg-card)" stroke="var(--accent)" strokeWidth={1.5} />
              <text x={h.x} y={h.y + 4} textAnchor="middle" fontSize={11} fill="var(--accent)">♥</text>
            </g>
          ))}

          {/* Nodes */}
          {nodes.map(node => {
            const p = node.person;
            const isSelected = p.id === selectedPersonId;
            const isRoot = p.id === rootId;
            const age = getAge(p.birthDate, p.deathDate);
            const year = formatYear(p.birthDate);
            const ariaLabel = `${getDisplayName(p)}${p.birthDate ? `, ${p.gender === 'female' ? 'née' : 'né'} en ${year}` : ''}`;

            return (
              <g key={p.id}
                className="person-node"
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleNodeClick(p.id)}
                onDoubleClick={() => { setRootId(p.id); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(p.id); }
                }}
                opacity={p.isAlive ? 1 : 0.8}
                style={{ cursor: 'pointer' }}
              >
                {/* Card background — flat at rest, single-colour border (Rare Accent Rule).
                    Generation reads by vertical position, never by colour. */}
                <rect width={NODE_W} height={NODE_H} rx={10} ry={10}
                  fill="var(--bg-card)"
                  stroke={isSelected ? 'var(--accent)' : isRoot ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={isSelected ? 2.5 : isRoot ? 2 : 1}
                />

                {/* Gender signal bar (left) */}
                <rect x={0} y={0} width={5} height={NODE_H} rx={10}
                  fill={genderColor(p.gender)} />
                <rect x={0} y={10} width={5} height={NODE_H - 20}
                  fill={genderColor(p.gender)} />

                {/* Root crown */}
                {isRoot && (
                  <Crown x={NODE_W - 24} y={7} width={15} height={15} color="var(--accent)" aria-hidden="true" />
                )}
                {/* Deceased cross */}
                {!p.isAlive && (
                  <Cross x={NODE_W - 22} y={NODE_H - 21} width={13} height={13} color="var(--deceased)" aria-hidden="true" />
                )}

                {/* Avatar */}
                <clipPath id={`clip-${p.id}`}>
                  <circle cx={30} cy={NODE_H / 2} r={20} />
                </clipPath>
                <circle cx={30} cy={NODE_H / 2} r={20} fill="var(--accent-light)" />
                {p.profilePhoto ? (
                  <image href={p.profilePhoto} x={10} y={NODE_H / 2 - 20} width={40} height={40}
                    clipPath={`url(#clip-${p.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text x={30} y={NODE_H / 2 + 5} textAnchor="middle" fontSize={16} fontWeight="700"
                    fontFamily="Lato, sans-serif" fill="var(--accent)">
                    {nodeInitials(p)}
                  </text>
                )}

                {/* First name */}
                <text x={60} y={NODE_H / 2 - 10} fontSize={13} fontWeight="700"
                  fontFamily="Lato, sans-serif" fill="var(--text)">
                  {p.firstName.length > 16 ? p.firstName.slice(0, 15) + '…' : p.firstName}
                </text>
                {/* Last name */}
                <text x={60} y={NODE_H / 2 + 6} fontSize={12}
                  fontFamily="Lato, sans-serif" fill="var(--text-muted)">
                  {p.lastName.length > 18 ? p.lastName.slice(0, 17) + '…' : p.lastName}
                </text>
                {/* Dates */}
                <text x={60} y={NODE_H / 2 + 22} fontSize={10.5}
                  fontFamily="Lato, sans-serif" fill="var(--text-light)">
                  {p.birthDate ? year : ''}
                  {!p.isAlive && p.deathDate ? ` – ${formatYear(p.deathDate)}` : ''}
                  {age !== null && p.isAlive ? ` · ${age} ans` : ''}
                </text>
              </g>
            );
          })}
        </svg>
        )}

        {/* Legend — compact, discreet, hidden by default */}
        {showLegend && (
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', maxWidth: '160px', background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', fontSize: '11px', color: 'var(--text-muted)', boxShadow: 'var(--shadow)' }}>
            <div className="label" style={{ marginBottom: '8px', color: 'var(--text)' }}>Légende</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '5px', height: '16px', background: 'var(--male)', borderRadius: '2px', flexShrink: 0 }} />
                <span>Homme</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '5px', height: '16px', background: 'var(--female)', borderRadius: '2px', flexShrink: 0 }} />
                <span>Femme</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="28" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="28" y2="4" stroke="var(--border)" strokeWidth="1.5" /></svg>
                <span>Filiation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="28" height="8" style={{ flexShrink: 0 }}><line x1="0" y1="4" x2="28" y2="4" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6,4" opacity="0.5" /></svg>
                <span>Conjoint(e)</span>
              </div>
            </div>
          </div>
        )}

        {/* Node count */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '100px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {nodes.length} / {tree.persons.length} personnes
        </div>

        {/* Minimap (vertical layout only) — always visible */}
        {layoutMode === 'vertical' && nodes.length > 0 && (() => {
          const MM_W = 160, MM_H = 100;
          const mmScale = Math.min(MM_W / svgW, MM_H / svgH);
          const drawW = svgW * mmScale, drawH = svgH * mmScale;
          const padX = (MM_W - drawW) / 2, padY = (MM_H - drawH) / 2;
          const cw = viewport.w, ch = viewport.h;
          // Visible viewport rectangle (content coords → minimap coords)
          const vx = padX + (-offset.x / scale) * mmScale;
          const vy = padY + (-offset.y / scale) * mmScale;
          const vw = (cw / scale) * mmScale;
          const vh = (ch / scale) * mmScale;
          const navigate = (e: React.MouseEvent) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const cx = minX + (e.clientX - rect.left - padX) / mmScale;
            const cy = minY + (e.clientY - rect.top - padY) / mmScale;
            setOffset({ x: cw / 2 - scale * (cx - minX), y: ch / 2 - scale * (cy - minY) });
          };
          return (
            <div
              onMouseDown={e => e.stopPropagation()}
              onClick={navigate}
              title="Cliquez pour naviguer"
              style={{ position: 'absolute', bottom: '16px', right: '16px', width: `${MM_W}px`, height: `${MM_H}px`, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', cursor: 'pointer' }}
            >
              <svg width={MM_W} height={MM_H} style={{ display: 'block' }}>
                {nodes.map(n => {
                  const active = n.person.id === selectedPersonId || n.person.id === rootId;
                  return (
                    <rect key={n.person.id}
                      x={padX + (n.x - minX) * mmScale}
                      y={padY + (n.y - minY) * mmScale}
                      width={6} height={4} rx={1}
                      fill={active ? 'var(--accent)' : 'var(--border)'}
                    />
                  );
                })}
                {/* Visible viewport */}
                <rect x={vx} y={vy} width={vw} height={vh}
                  fill="transparent" stroke="var(--accent)" strokeWidth={1.5} rx={2} />
              </svg>
              <div className="label" style={{ position: 'absolute', top: '3px', left: '6px', fontSize: '9px', pointerEvents: 'none' }}>Minimap</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ===== Fan chart (ancestor pedigree, pure SVG, auto-fit) =====
interface FanData { slots: { person: Person; gen: number; index: number }[]; maxGen: number; R: number; }

function FanChart({ fan, fanGenColor, r0, ring, selectedPersonId, onSelectPerson }: {
  fan: FanData;
  fanGenColor: (gen: number) => string;
  r0: number;
  ring: number;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
}) {
  const pad = 32;
  const view = fan.R + pad;

  const ang = (a: number) => -Math.PI / 2 + a; // 0 at top, clockwise
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
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox={`${-view} ${-view} ${view * 2} ${view * 2}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Ancestor rings */}
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
          <g key={s.person.id} style={{ cursor: 'pointer' }} onClick={() => onSelectPerson(s.person.id)}>
            <path d={annular(rInner, rOuter, a0, a1)}
              fill={fanGenColor(s.gen)} fillOpacity={isSel ? 0.95 : 0.82}
              stroke={isSel ? 'var(--accent)' : 'var(--bg-card)'} strokeWidth={isSel ? 3 : 1.5} />
            <text x={tx} y={ty} transform={`rotate(${rot.toFixed(1)} ${tx.toFixed(2)} ${ty.toFixed(2)})`}
              textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={600}
              fontFamily="Lato, sans-serif" fill="#fff" style={{ pointerEvents: 'none' }}>
              {label}
            </text>
          </g>
        );
      })}

      {/* Root at the centre */}
      {root && (
        <g style={{ cursor: 'pointer' }} onClick={() => onSelectPerson(root.person.id)}>
          <circle cx={0} cy={0} r={r0}
            fill={fanGenColor(0)}
            stroke="var(--accent)"
            strokeWidth={root.person.id === selectedPersonId ? 3 : 2} />
          <text x={0} y={-6} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fontFamily="Lato, sans-serif" fill="#fff" style={{ pointerEvents: 'none' }}>
            {root.person.firstName.length > 12 ? root.person.firstName.slice(0, 11) + '…' : root.person.firstName}
          </text>
          <text x={0} y={12} textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily="Lato, sans-serif" fill="#fff" fillOpacity={0.85} style={{ pointerEvents: 'none' }}>
            {root.person.lastName.length > 13 ? root.person.lastName.slice(0, 12) + '…' : root.person.lastName}
          </text>
        </g>
      )}

      {fan.maxGen === 0 && (
        <text x={0} y={r0 + 30} textAnchor="middle" fontSize={13} fontFamily="Lato, sans-serif" fill="var(--text-muted)">
          Aucun ancêtre enregistré pour cette racine
        </text>
      )}
    </svg>
  );
}
