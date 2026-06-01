import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses } from '@/lib/treeUtils';

export const NODE_W = 168;
export const NODE_H = 84;
export const H_GAP = 48;
export const V_GAP = 88;

export interface LayoutNode {
  person: Person;
  x: number;
  y: number;
}

export interface LayoutEdge {
  x1: number; y1: number; x2: number; y2: number;
  type: string;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Computes a static genealogical layout (descendants + ancestors of the root),
 * mirroring the interactive TreeView so the visual export matches the on-screen tree.
 */
export function buildTreeLayout(tree: FamilyTree, rootId: string | null): TreeLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const visited = new Set<string>();

  const root = rootId ? tree.persons.find(p => p.id === rootId) : null;
  if (!root || !rootId) {
    return { nodes: [], edges: [], minX: 0, minY: 0, width: 0, height: 0 };
  }

  function placeFamily(personId: string, genY: number, centerX: number) {
    if (visited.has(personId)) return;
    visited.add(personId);
    const person = tree.persons.find(p => p.id === personId);
    if (!person) return;

    const spouses = getSpouses(personId, tree.relationships, tree.persons).filter(s => !visited.has(s.id));
    const totalWidth = (1 + spouses.length) * (NODE_W + H_GAP);
    let startX = centerX - totalWidth / 2 + (NODE_W + H_GAP) / 2;

    nodes.push({ person, x: startX, y: genY });
    const mainX = startX;
    startX += NODE_W + H_GAP;

    spouses.forEach(spouse => {
      visited.add(spouse.id);
      nodes.push({ person: spouse, x: startX, y: genY });
      edges.push({ x1: mainX + NODE_W, y1: genY + NODE_H / 2, x2: startX, y2: genY + NODE_H / 2, type: 'spouse' });
      startX += NODE_W + H_GAP;
    });

    const children = getChildren(personId, tree.relationships, tree.persons);
    if (children.length > 0) {
      const childY = genY + NODE_H + V_GAP;
      const childTotalW = children.length * (NODE_W + H_GAP) - H_GAP;
      const childStartX = centerX - childTotalW / 2;
      const parentMidX = mainX + NODE_W / 2;
      const childMidY = genY + NODE_H + V_GAP / 2;

      children.forEach((child, i) => {
        const childX = childStartX + i * (NODE_W + H_GAP);
        const childMidX = childX + NODE_W / 2;
        edges.push({ x1: parentMidX, y1: genY + NODE_H, x2: parentMidX, y2: childMidY, type: 'parent-v' });
        edges.push({ x1: parentMidX, y1: childMidY, x2: childMidX, y2: childMidY, type: 'parent-h' });
        edges.push({ x1: childMidX, y1: childMidY, x2: childMidX, y2: childY, type: 'parent-v' });
        placeFamily(child.id, childY, childX + NODE_W / 2);
      });
    }

    if (personId === rootId) {
      const parents = getParents(personId, tree.relationships, tree.persons);
      if (parents.length > 0) {
        const parentY = genY - NODE_H - V_GAP;
        const parentTotalW = parents.length * (NODE_W + H_GAP) - H_GAP;
        const parentStartX = centerX - parentTotalW / 2;
        const childMidX = mainX + NODE_W / 2;
        const midY = genY - V_GAP / 2;

        parents.forEach((parent, i) => {
          const parentX = parentStartX + i * (NODE_W + H_GAP);
          const parentMidX2 = parentX + NODE_W / 2;
          if (!visited.has(parent.id)) {
            visited.add(parent.id);
            nodes.push({ person: parent, x: parentX, y: parentY });
          }
          edges.push({ x1: parentMidX2, y1: parentY + NODE_H, x2: parentMidX2, y2: midY, type: 'parent-v' });
          edges.push({ x1: parentMidX2, y1: midY, x2: childMidX, y2: midY, type: 'parent-h' });
          edges.push({ x1: childMidX, y1: midY, x2: childMidX, y2: genY, type: 'parent-v' });

          const grandparents = getParents(parent.id, tree.relationships, tree.persons);
          if (grandparents.length > 0) {
            const gpY = parentY - NODE_H - V_GAP;
            grandparents.forEach((gp, j) => {
              const gpX = parentX + (j - (grandparents.length - 1) / 2) * (NODE_W + H_GAP);
              if (!visited.has(gp.id)) {
                visited.add(gp.id);
                nodes.push({ person: gp, x: gpX, y: gpY });
                edges.push({ x1: gpX + NODE_W / 2, y1: gpY + NODE_H, x2: gpX + NODE_W / 2, y2: parentY - V_GAP / 2, type: 'parent-v' });
                edges.push({ x1: gpX + NODE_W / 2, y1: parentY - V_GAP / 2, x2: parentMidX2, y2: parentY - V_GAP / 2, type: 'parent-h' });
                edges.push({ x1: parentMidX2, y1: parentY - V_GAP / 2, x2: parentMidX2, y2: parentY, type: 'parent-v' });
              }
            });
          }
        });
      }
    }
  }

  placeFamily(rootId, 0, 0);

  // Place any remaining (disconnected) members in a row below everything.
  const placedIds = new Set(nodes.map(n => n.person.id));
  const remaining = tree.persons.filter(p => !placedIds.has(p.id));
  if (remaining.length > 0 && nodes.length > 0) {
    const baseY = Math.max(...nodes.map(n => n.y)) + NODE_H + V_GAP * 1.5;
    remaining.forEach((p, i) => {
      nodes.push({ person: p, x: i * (NODE_W + H_GAP), y: baseY });
    });
  }

  const PAD = 60;
  const minX = nodes.length ? Math.min(...nodes.map(n => n.x)) - PAD : 0;
  const maxX = nodes.length ? Math.max(...nodes.map(n => n.x)) + NODE_W + PAD : 0;
  const minY = nodes.length ? Math.min(...nodes.map(n => n.y)) - PAD : 0;
  const maxY = nodes.length ? Math.max(...nodes.map(n => n.y)) + NODE_H + PAD : 0;

  return { nodes, edges, minX, minY, width: maxX - minX, height: maxY - minY };
}
