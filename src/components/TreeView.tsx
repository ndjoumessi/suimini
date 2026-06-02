'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getDisplayName, formatYear, getAge } from '@/lib/treeUtils';
import { Search, ZoomIn, ZoomOut, Crosshair, Eye, EyeOff, Plus, Aperture, Crown, Cross, Sprout } from 'lucide-react';

/** Two-letter initials for the avatar fallback (same logic as PersonPanel/Sidebar). */
function nodeInitials(p: Person): string {
  return (((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase()) || '?';
}

/** Monochrome taupe scale: t=0 → accent-light (#f0e8da, oldest), t=1 → accent (#8b6f47, newest). */
function taupeScale(t: number): string {
  const a = [240, 232, 218]; // #f0e8da
  const b = [139, 111, 71];  // #8b6f47
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

const NODE_W = 168;
const NODE_H = 84;
const H_GAP = 48;
const V_GAP = 88;

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
  const [showLegend, setShowLegend] = useState(true);
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

  // Generation index (by vertical position) → color gradient, oldest (top) to newest (bottom).
  const genYs = Array.from(new Set(nodes.map(n => n.y))).sort((a, b) => a - b);
  const genIndexOfY = new Map(genYs.map((y, i) => [y, i]));
  const genCount = genYs.length;
  const generationColor = (y: number) => {
    const idx = genIndexOfY.get(y) ?? 0;
    // Monochrome taupe ramp: oldest (top) = accent-light → newest (bottom) = accent.
    const t = genCount <= 1 ? 1 : idx / (genCount - 1);
    return taupeScale(t);
  };

  // ---- Fan chart (ancestor pedigree) layout ----
  const MAX_FAN_GEN = 4;
  const FAN_R0 = 54;   // central root circle radius
  const FAN_RING = 70; // ring width per generation
  const fanGenColor = (gen: number) => {
    // Same monochrome taupe ramp, centre (root, newest) = accent → outer (older) = accent-light.
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

  // Center on root on load
  useEffect(() => {
    const root = nodes.find(n => n.person.id === rootId);
    if (root && containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      setOffset({
        x: cw / 2 - (root.x + NODE_W / 2) * scale,
        y: ch / 3 - (root.y + NODE_H / 2) * scale,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId]);

  // Track container size for the minimap viewport rectangle (ResizeObserver fires on observe).
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

  function centerOnPerson(id: string) {
    const node = nodes.find(n => n.person.id === id);
    if (node && containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      setOffset({
        x: cw / 2 - (node.x + NODE_W / 2) * scale,
        y: ch / 2 - (node.y + NODE_H / 2) * scale,
      });
    }
  }

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.2rem', flex: 1, minWidth: '100px' }}>
          {tree.name}
        </h2>

        {/* Search root */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSearch(!showSearch)} className="btn btn-secondary btn-sm" aria-label="Changer la racine de l'arbre">
            <Search size={14} /> Racine
          </button>
          {showSearch && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px', width: '240px', boxShadow: 'var(--shadow-lg)' }}>
              <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Nom de la personne..." className="input" style={{ marginBottom: '6px' }} />
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {(searchQ ? filteredPersons : tree.persons.slice(0, 20)).map(p => (
                  <button key={p.id} onClick={() => { setRootId(p.id); setShowSearch(false); setSearchQ(''); setTimeout(() => centerOnPerson(p.id), 100); }}
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

        <button onClick={() => setLayoutMode(m => m === 'fan' ? 'vertical' : 'fan')} className="btn btn-sm" title="Basculer en éventail (fan chart)" aria-pressed={layoutMode === 'fan'}
          style={{ background: layoutMode === 'fan' ? 'var(--accent)' : 'var(--bg-muted)', color: layoutMode === 'fan' ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <Aperture size={14} /> Fan
        </button>
        {layoutMode === 'vertical' && <>
          <button onClick={() => { if(containerRef.current && nodes.length) { const root = nodes.find(n => n.person.id === rootId); if(root) { const cw = containerRef.current.clientWidth; const ch = containerRef.current.clientHeight; setOffset({ x: cw/2 - (root.x + NODE_W/2)*scale, y: ch/3 - (root.y + NODE_H/2)*scale }); } } }} className="btn btn-secondary btn-sm btn-icon" title="Centrer sur la racine" aria-label="Centrer sur la racine"><Crosshair size={15} /></button>
          <button onClick={() => setScale(s => Math.min(2.5, s * 1.2))} className="btn btn-secondary btn-sm btn-icon" title="Zoom avant" aria-label="Zoom avant"><ZoomIn size={15} /></button>
          <button onClick={() => setScale(1)} className="btn btn-secondary btn-sm" style={{ minWidth: '48px' }} title="Réinitialiser le zoom" aria-label="Réinitialiser le zoom">{Math.round(scale * 100)}%</button>
          <button onClick={() => setScale(s => Math.max(0.25, s * 0.8))} className="btn btn-secondary btn-sm btn-icon" title="Zoom arrière" aria-label="Zoom arrière"><ZoomOut size={15} /></button>
        </>}
        <button onClick={() => setShowLegend(l => !l)} className="btn btn-secondary btn-sm" aria-pressed={showLegend}>
          {showLegend ? <EyeOff size={14} /> : <Eye size={14} />} Légende
        </button>
        <button onClick={onAddPerson} className="btn btn-primary btn-sm"><Plus size={14} /> Ajouter</button>
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
          <defs>
            <filter id="node-shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => (
            <line key={i}
              x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
              stroke={edge.type === 'spouse' ? 'var(--accent)' : 'var(--border)'}
              strokeWidth={edge.type === 'spouse' ? 2.5 : 1.5}
              strokeDasharray={edge.type === 'spouse' ? '7,4' : 'none'}
            />
          ))}

          {/* Couple hearts */}
          {hearts.map((h, i) => (
            <g key={`heart-${i}`} style={{ pointerEvents: 'none' }}>
              <circle cx={h.x} cy={h.y} r={10} fill="var(--bg-card)" stroke="var(--accent)" strokeWidth={1.5} />
              <text x={h.x} y={h.y + 4} textAnchor="middle" fontSize={12} fill="var(--accent)">♥</text>
            </g>
          ))}

          {/* Nodes */}
          {nodes.map(node => {
            const p = node.person;
            const isSelected = p.id === selectedPersonId;
            const isRoot = p.id === rootId;
            const age = getAge(p.birthDate, p.deathDate);
            const genCol = generationColor(node.y);

            return (
              <g key={p.id}
                className="person-node"
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleNodeClick(p.id)}
                onDoubleClick={() => { setRootId(p.id); }}
                style={{ cursor: 'pointer' }}
              >
                {/* Card background (flat at rest — no baked shadow; the generation-coloured border separates nodes) */}
                <rect width={NODE_W} height={NODE_H} rx={10} ry={10}
                  fill={isSelected ? 'var(--accent-light)' : 'var(--bg-card)'}
                  stroke={isSelected ? 'var(--accent)' : isRoot ? 'var(--accent)' : genCol}
                  strokeWidth={isSelected ? 2.5 : isRoot ? 2 : 1.8}
                />
                {/* Gender bar */}
                <rect x={0} y={0} width={5} height={NODE_H} rx={10}
                  fill={genderColor(p.gender)} />
                <rect x={0} y={10} width={5} height={NODE_H - 20}
                  fill={genderColor(p.gender)} />

                {/* Root crown */}
                {isRoot && (
                  <Crown x={NODE_W - 21} y={6} width={13} height={13} color="var(--accent)" aria-hidden="true" />
                )}
                {/* Deceased cross */}
                {!p.isAlive && (
                  <Cross x={NODE_W - 20} y={NODE_H - 18} width={12} height={12} color="var(--deceased)" aria-hidden="true" />
                )}

                {/* Avatar circle */}
                <clipPath id={`clip-${p.id}`}>
                  <circle cx={28} cy={NODE_H / 2} r={18} />
                </clipPath>
                <circle cx={28} cy={NODE_H / 2} r={18} fill="var(--accent-light)" />
                {p.profilePhoto ? (
                  <image href={p.profilePhoto} x={10} y={NODE_H / 2 - 18} width={36} height={36}
                    clipPath={`url(#clip-${p.id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text x={28} y={NODE_H / 2 + 4} textAnchor="middle" fontSize={13} fontWeight="700"
                    fontFamily="Lato, sans-serif" fill="var(--accent)">
                    {nodeInitials(p)}
                  </text>
                )}

                {/* Name */}
                <text x={54} y={NODE_H / 2 - 8} fontSize={12} fontWeight="700"
                  fontFamily="Lato, sans-serif" fill={isSelected ? 'var(--accent)' : 'var(--text)'}
                  clipPath="url(#text-clip)">
                  {p.firstName.length > 12 ? p.firstName.slice(0, 11) + '…' : p.firstName}
                </text>
                <text x={54} y={NODE_H / 2 + 7} fontSize={11}
                  fontFamily="Lato, sans-serif" fill="var(--text-muted)">
                  {p.lastName.length > 13 ? p.lastName.slice(0, 12) + '…' : p.lastName}
                </text>

                {/* Dates (birth marked by a small point; death by the corner cross + en-dash range) */}
                {p.birthDate && (
                  <circle cx={52} cy={NODE_H / 2 + 17} r={1.6} fill={p.isAlive ? 'var(--success)' : 'var(--text-light)'} />
                )}
                <text x={58} y={NODE_H / 2 + 21} fontSize={9.5}
                  fontFamily="Lato, sans-serif"
                  fill={p.isAlive ? 'var(--success)' : 'var(--text-light)'}>
                  {p.birthDate ? formatYear(p.birthDate) : ''}
                  {!p.isAlive && p.deathDate ? ` – ${formatYear(p.deathDate)}` : ''}
                  {age !== null && p.isAlive ? ` · ${age} ans` : ''}
                </text>

                {/* Hover highlight ring */}
                <rect width={NODE_W} height={NODE_H} rx={10} ry={10}
                  fill="transparent"
                  stroke="var(--accent)"
                  strokeWidth={0}
                  className={`node-hover-ring`}
                  style={{ transition: 'stroke-width 0.15s' }}
                />
              </g>
            );
          })}
        </svg>
        )}

        {/* Legend */}
        {showLegend && (
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)', boxShadow: 'var(--shadow)', minWidth: '170px' }}>
            <div style={{ fontWeight: '700', marginBottom: '8px', color: 'var(--text)', fontSize: '12px' }}>Légende</div>
            {/* Gender */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '5px', height: '20px', background: 'var(--male)', borderRadius: '2px' }} />
                <span>Homme</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '5px', height: '20px', background: 'var(--female)', borderRadius: '2px' }} />
                <span>Femme</span>
              </div>
            </div>
            {/* Relations */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              <div style={{ fontWeight: '700', marginBottom: '2px', color: 'var(--text)', fontSize: '11px' }}>Relations</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="var(--border)" strokeWidth="1.5" /></svg>
                <span>Parent → Enfant</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="6,3" /></svg>
                <span>Conjoint(e)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '32px', textAlign: 'center', color: 'var(--accent)' }}>♥</span>
                <span>Mariage (couple)</span>
              </div>
            </div>
            {/* Generations */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginBottom: '8px' }}>
              <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text)', fontSize: '11px' }}>Générations</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: taupeScale(0), border: '1px solid var(--border)', flexShrink: 0 }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: taupeScale(0.5), flexShrink: 0 }} />
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: taupeScale(1), flexShrink: 0 }} />
                <span style={{ display: 'flex', justifyContent: 'space-between', flex: 1, fontSize: '9px', color: 'var(--text-light)' }}>
                  <span>Ancien</span><span>Récent</span>
                </span>
              </div>
            </div>
            {/* Symbols */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Crown size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" /> Racine de l&apos;arbre</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Cross size={13} style={{ color: 'var(--deceased)', flexShrink: 0 }} aria-hidden="true" /> Décédé(e)</div>
              <div style={{ marginTop: '4px', color: 'var(--text-light)', fontSize: '10px', lineHeight: '1.4' }}>
                Clic → voir le profil<br/>
                Double-clic → nouvelle racine<br/>
                Molette → zoom
              </div>
            </div>
          </div>
        )}

        {/* Node count */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '100px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          {nodes.length} / {tree.persons.length} personnes
        </div>

        {/* Minimap (vertical layout only) */}
        {layoutMode === 'vertical' && nodes.length > 0 && (() => {
          const MM_W = 180, MM_H = 120;
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
                {nodes.map(n => (
                  <rect key={n.person.id}
                    x={padX + (n.x - minX) * mmScale}
                    y={padY + (n.y - minY) * mmScale}
                    width={Math.max(2, NODE_W * mmScale)}
                    height={Math.max(1.5, NODE_H * mmScale)}
                    rx={1.5}
                    fill={generationColor(n.y)}
                    opacity={0.85}
                  />
                ))}
                <rect x={vx} y={vy} width={vw} height={vh}
                  fill="var(--accent)" fillOpacity={0.14} stroke="var(--accent)" strokeWidth={1.5} rx={2} />
              </svg>
              <div style={{ position: 'absolute', top: '2px', left: '6px', fontSize: '9px', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', pointerEvents: 'none' }}>Minimap</div>
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
            stroke={root.person.id === selectedPersonId ? 'var(--accent)' : 'var(--accent)'}
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
