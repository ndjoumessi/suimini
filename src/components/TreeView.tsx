'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getDisplayName, formatYear, getAge } from '@/lib/treeUtils';

interface TreeNode {
  person: Person;
  x: number;
  y: number;
  generation: number;
}

interface Props {
  tree: FamilyTree;
  selectedPersonId: string | null;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
}

const NODE_W = 160;
const NODE_H = 80;
const H_GAP = 40;
const V_GAP = 80;

export default function TreeView({ tree, selectedPersonId, onSelectPerson, onAddPerson }: Props) {
  const [rootId, setRootId] = useState(tree.rootPersonId || tree.persons[0]?.id || null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const rootPerson = tree.persons.find(p => p.id === rootId);

  // Build tree layout
  const buildLayout = useCallback(() => {
    if (!rootId || !rootPerson) return { nodes: [], edges: [] };
    
    const nodes: TreeNode[] = [];
    const edges: { x1: number; y1: number; x2: number; y2: number; type: string }[] = [];
    const visited = new Set<string>();

    function placeFamily(personId: string, genY: number, centerX: number) {
      if (visited.has(personId)) return;
      visited.add(personId);

      const person = tree.persons.find(p => p.id === personId);
      if (!person) return;

      const spouses = getSpouses(personId, tree.relationships, tree.persons);
      const totalWidth = (1 + spouses.length) * (NODE_W + H_GAP);
      let startX = centerX - totalWidth / 2 + (NODE_W + H_GAP) / 2;

      nodes.push({ person, x: startX, y: genY, generation: genY / (NODE_H + V_GAP) });
      startX += NODE_W + H_GAP;

      spouses.forEach(spouse => {
        if (!visited.has(spouse.id)) {
          visited.add(spouse.id);
          nodes.push({ person: spouse, x: startX, y: genY, generation: genY / (NODE_H + V_GAP) });
          // Spouse connector
          edges.push({ x1: startX - H_GAP, y1: genY + NODE_H / 2, x2: startX, y2: genY + NODE_H / 2, type: 'spouse' });
          startX += NODE_W + H_GAP;
        }
      });

      // Children
      const children = getChildren(personId, tree.relationships, tree.persons);
      if (children.length > 0) {
        const childY = genY + NODE_H + V_GAP;
        const childTotalW = children.length * (NODE_W + H_GAP) - H_GAP;
        const childStartX = centerX - childTotalW / 2;

        children.forEach((child, i) => {
          const childX = childStartX + i * (NODE_W + H_GAP);
          const parentNode = nodes.find(n => n.person.id === personId);
          if (parentNode) {
            edges.push({ 
              x1: parentNode.x + NODE_W / 2, y1: parentNode.y + NODE_H, 
              x2: childX + NODE_W / 2, y2: childY, type: 'parent'
            });
          }
          placeFamily(child.id, childY, childX + NODE_W / 2);
        });
      }

      // Parents (upward)
      const parents = getParents(personId, tree.relationships, tree.persons);
      if (parents.length > 0 && genY === 0) {
        const parentY = genY - NODE_H - V_GAP;
        const parentCenterX = centerX;
        const parentTotalW = parents.length * (NODE_W + H_GAP) - H_GAP;
        const parentStartX = parentCenterX - parentTotalW / 2;

        parents.forEach((parent, i) => {
          const parentX = parentStartX + i * (NODE_W + H_GAP);
          if (!visited.has(parent.id)) {
            visited.add(parent.id);
            nodes.push({ person: parent, x: parentX, y: parentY, generation: -1 });
          }
          edges.push({
            x1: parentX + NODE_W / 2, y1: parentY + NODE_H,
            x2: centerX, y2: genY, type: 'parent'
          });

          // Grandparents
          const grandparents = getParents(parent.id, tree.relationships, tree.persons);
          if (grandparents.length > 0) {
            const gpY = parentY - NODE_H - V_GAP;
            grandparents.forEach((gp, j) => {
              const gpX = parentX + (j - 0.5) * (NODE_W + H_GAP);
              if (!visited.has(gp.id)) {
                visited.add(gp.id);
                nodes.push({ person: gp, x: gpX, y: gpY, generation: -2 });
                edges.push({
                  x1: gpX + NODE_W / 2, y1: gpY + NODE_H,
                  x2: parentX + NODE_W / 2, y2: parentY, type: 'parent'
                });
              }
            });
          }
        });
      }
    }

    placeFamily(rootId, 0, 0);
    return { nodes, edges };
  }, [rootId, rootPerson, tree]);

  const { nodes, edges } = buildLayout();

  // Calculate SVG dimensions
  const minX = nodes.length ? Math.min(...nodes.map(n => n.x)) - 40 : -400;
  const maxX = nodes.length ? Math.max(...nodes.map(n => n.x)) + NODE_W + 40 : 400;
  const minY = nodes.length ? Math.min(...nodes.map(n => n.y)) - 40 : -200;
  const maxY = nodes.length ? Math.max(...nodes.map(n => n.y)) + NODE_H + 40 : 400;
  const svgW = maxX - minX;
  const svgH = maxY - minY;

  useEffect(() => {
    if (nodes.length > 0) {
      const root = nodes.find(n => n.person.id === rootId);
      if (root && containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        setOffset({
          x: cw / 2 - (root.x + NODE_W / 2) * scale,
          y: ch / 2 - (root.y + NODE_H / 2) * scale,
        });
      }
    }
  }, [rootId]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.3, Math.min(2, s * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setDragging(false);

  const genderColor = (gender: string) => {
    if (gender === 'male') return 'var(--male)';
    if (gender === 'female') return 'var(--female)';
    return 'var(--text-muted)';
  };

  const filteredPersons = showSearch
    ? tree.persons.filter(p =>
        getDisplayName(p).toLowerCase().includes(searchQ.toLowerCase())
      )
    : [];

  if (tree.persons.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div style={{ fontSize: '48px' }}>🌱</div>
        <h3>Cet arbre est vide</h3>
        <p style={{ color: 'var(--text-muted)' }}>Ajoutez la première personne pour commencer</p>
        <button onClick={onAddPerson} className="btn btn-primary">＋ Première personne</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '10px 16px', borderBottom: '1px solid var(--border)', 
        background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <h2 className="serif" style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>
          {tree.name}
        </h2>
        
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSearch(!showSearch)} className="btn btn-secondary btn-sm">
            🔍 Racine
          </button>
          {showSearch && (
            <div style={{ 
              position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: '4px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '8px', width: '220px',
              boxShadow: 'var(--shadow-lg)'
            }}>
              <input
                autoFocus
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Rechercher..."
                className="input"
                style={{ marginBottom: '6px' }}
              />
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {filteredPersons.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setRootId(p.id); setShowSearch(false); setSearchQ(''); }}
                    style={{
                      width: '100%', padding: '6px 8px', border: 'none', background: 'none',
                      cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius)',
                      fontSize: '13px', color: 'var(--text)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {getDisplayName(p)} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formatYear(p.birthDate)}
                    </span>
                  </button>
                ))}
                {searchQ && filteredPersons.length === 0 && (
                  <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>Aucun résultat</div>
                )}
              </div>
            </div>
          )}
        </div>

        <button onClick={() => setScale(s => Math.min(2, s * 1.2))} className="btn btn-secondary btn-sm">＋</button>
        <button onClick={() => setScale(1)} className="btn btn-secondary btn-sm">{Math.round(scale * 100)}%</button>
        <button onClick={() => setScale(s => Math.max(0.3, s * 0.8))} className="btn btn-secondary btn-sm">−</button>
        <button onClick={onAddPerson} className="btn btn-primary btn-sm">＋ Ajouter</button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ 
          flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab',
          position: 'relative', background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundSize: `${30 * scale}px ${30 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
        onClick={() => showSearch && setShowSearch(false)}
      >
        <svg
          style={{ 
            position: 'absolute', left: 0, top: 0,
            transformOrigin: '0 0',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            overflow: 'visible'
          }}
          width={svgW} height={svgH}
          viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const midY = (edge.y1 + edge.y2) / 2;
            return (
              <path
                key={i}
                d={edge.type === 'spouse'
                  ? `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`
                  : `M ${edge.x1} ${edge.y1} C ${edge.x1} ${midY}, ${edge.x2} ${midY}, ${edge.x2} ${edge.y2}`
                }
                stroke={edge.type === 'spouse' ? '#e8a0b0' : 'var(--border)'}
                strokeWidth={edge.type === 'spouse' ? 2 : 1.5}
                strokeDasharray={edge.type === 'spouse' ? '6,4' : 'none'}
                fill="none"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const p = node.person;
            const isSelected = p.id === selectedPersonId;
            const isRoot = p.id === rootId;
            const age = getAge(p.birthDate, p.deathDate);
            
            return (
              <g key={p.id} transform={`translate(${node.x}, ${node.y})`}>
                <rect
                  width={NODE_W} height={NODE_H}
                  rx={8} ry={8}
                  fill={isSelected ? 'var(--accent-light)' : 'var(--bg-card)'}
                  stroke={isSelected ? 'var(--accent)' : isRoot ? '#c4a35a' : 'var(--border)'}
                  strokeWidth={isSelected ? 2.5 : isRoot ? 2 : 1.5}
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))', cursor: 'pointer' }}
                  onClick={() => onSelectPerson(p.id)}
                />
                {/* Gender accent bar */}
                <rect
                  x={0} y={0} width={4} height={NODE_H}
                  rx={8} fill={genderColor(p.gender)}
                  onClick={() => onSelectPerson(p.id)}
                  style={{ cursor: 'pointer' }}
                />
                {/* Root crown */}
                {isRoot && (
                  <text x={NODE_W - 14} y={16} fontSize={12} textAnchor="middle">👑</text>
                )}
                {/* Profile avatar */}
                {p.profilePhoto && (
                  <image
                    href={p.profilePhoto}
                    x={10} y={10}
                    width={32} height={32}
                    clipPath={`url(#clip-${p.id})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectPerson(p.id)}
                  />
                )}
                <clipPath id={`clip-${p.id}`}>
                  <circle cx={26} cy={26} r={16} />
                </clipPath>
                {!p.profilePhoto && (
                  <circle cx={26} cy={26} r={16} fill={p.gender === 'male' ? '#deeaf5' : p.gender === 'female' ? '#f5dde8' : 'var(--bg-muted)'} style={{ cursor: 'pointer' }} onClick={() => onSelectPerson(p.id)} />
                )}
                {!p.profilePhoto && (
                  <text x={26} y={31} textAnchor="middle" fontSize={16} style={{ cursor: 'pointer' }} onClick={() => onSelectPerson(p.id)}>
                    {p.gender === 'male' ? '👨' : p.gender === 'female' ? '👩' : '🧑'}
                  </text>
                )}

                {/* Name */}
                <text
                  x={52} y={28}
                  fontSize={12} fontWeight="700"
                  fontFamily="Lato, sans-serif"
                  fill={isSelected ? 'var(--accent)' : 'var(--text)'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectPerson(p.id)}
                >
                  {p.firstName}
                </text>
                <text
                  x={52} y={42}
                  fontSize={11}
                  fontFamily="Lato, sans-serif"
                  fill="var(--text-muted)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectPerson(p.id)}
                >
                  {p.lastName}
                </text>

                {/* Dates */}
                <text
                  x={10} y={NODE_H - 8}
                  fontSize={10}
                  fontFamily="Lato, sans-serif"
                  fill={p.isAlive ? 'var(--success)' : 'var(--text-light)'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectPerson(p.id)}
                >
                  {p.birthDate ? `✦ ${formatYear(p.birthDate)}` : ''}
                  {!p.isAlive && p.deathDate ? ` – ✝ ${formatYear(p.deathDate)}` : ''}
                  {age !== null && p.isAlive ? ` (${age} ans)` : ''}
                </text>

                {/* Double-click to set as root */}
                <rect
                  width={NODE_W} height={NODE_H}
                  rx={8} fill="transparent"
                  onDoubleClick={() => setRootId(p.id)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ 
          position: 'absolute', bottom: '16px', right: '16px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 14px',
          fontSize: '11px', color: 'var(--text-muted)',
          boxShadow: 'var(--shadow)'
        }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text)' }}>Légende</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div><span style={{ color: 'var(--male)' }}>■</span> Homme</div>
            <div><span style={{ color: 'var(--female)' }}>■</span> Femme</div>
            <div>Double-clic = définir racine</div>
            <div>Molette = zoom</div>
          </div>
        </div>

        {/* Node count */}
        <div style={{ 
          position: 'absolute', top: '12px', right: '12px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '100px', padding: '4px 10px',
          fontSize: '11px', color: 'var(--text-muted)'
        }}>
          {nodes.length} / {tree.persons.length} affichés
        </div>
      </div>
    </div>
  );
}
