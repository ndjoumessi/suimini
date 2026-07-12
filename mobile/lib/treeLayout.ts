/**
 * Minimal generational layout for the mobile SVG tree. Each person is placed on
 * a row by generation (0 = eldest ancestors at the top); rows are centered so
 * the canvas reads as a descent chart. Returns absolute coordinates plus the
 * parent→child edges to draw.
 */
import type { Person, Relationship } from './types';
import { getGeneration } from './treeUtils';

export const NODE_W = 130;
export const NODE_H = 70;
const COL_GAP = 28;
const ROW_GAP = 64;
const PADDING = 40;

export interface LayoutNode {
  person: Person;
  x: number;
  y: number;
}

export interface LayoutEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export function computeLayout(
  persons: Person[],
  relationships: Relationship[],
): TreeLayout {
  if (persons.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const memo = new Map<string, number>();
  const genOf = (id: string) => getGeneration(id, relationships, persons, memo);

  // Bucket people by generation.
  const rows = new Map<number, Person[]>();
  persons.forEach((p) => {
    const g = genOf(p.id);
    if (!rows.has(g)) rows.set(g, []);
    rows.get(g)!.push(p);
  });

  const gens = Array.from(rows.keys()).sort((a, b) => a - b);
  const widest = Math.max(...gens.map((g) => rows.get(g)!.length));
  const canvasWidth = PADDING * 2 + widest * NODE_W + (widest - 1) * COL_GAP;

  const pos = new Map<string, { x: number; y: number }>();
  const nodes: LayoutNode[] = [];

  gens.forEach((g, rowIndex) => {
    const row = rows.get(g)!;
    if (rowIndex === 0) {
      // Eldest row has no placed parents yet — order the founders themselves
      // by birth date then name.
      row.sort((a, b) => {
        const da = a.birthDate ?? '';
        const db = b.birthDate ?? '';
        if (da && db) return da.localeCompare(db);
        return a.firstName.localeCompare(b.firstName);
      });
    } else {
      // Barycenter heuristic (classic layered-graph technique): order each
      // row by the average x of the person's already-placed parents, instead
      // of raw birth date/name. A pure birth-date sort scatters siblings
      // across a wide generation independently of which parent they belong
      // to, so parent→child edges end up as long crossing diagonals — a
      // "spaghetti" tree on any generation with more than a handful of
      // people. Anchoring children near their parents' column collapses most
      // of that crossing into short, mostly-vertical connectors. People with
      // no parent placed yet (e.g. a spouse marrying into the tree) fall back
      // to birth date/name and sort after lineage-anchored siblings.
      const barycenterOf = (p: Person): number => {
        const parentXs = relationships
          .filter((r) => r.type === 'parent' && r.person2Id === p.id)
          .map((r) => pos.get(r.person1Id)?.x)
          .filter((x): x is number => x != null);
        if (!parentXs.length) return Number.POSITIVE_INFINITY;
        return parentXs.reduce((sum, x) => sum + x, 0) / parentXs.length;
      };
      row.sort((a, b) => {
        const ba = barycenterOf(a);
        const bb = barycenterOf(b);
        const finiteA = Number.isFinite(ba);
        const finiteB = Number.isFinite(bb);
        if (finiteA && finiteB && ba !== bb) return ba - bb;
        if (finiteA !== finiteB) return finiteA ? -1 : 1; // anchored siblings before floaters
        const da = a.birthDate ?? '';
        const db = b.birthDate ?? '';
        if (da && db) return da.localeCompare(db);
        return a.firstName.localeCompare(b.firstName);
      });
    }
    const rowWidth = row.length * NODE_W + (row.length - 1) * COL_GAP;
    const startX = (canvasWidth - rowWidth) / 2;
    const y = PADDING + rowIndex * (NODE_H + ROW_GAP);
    row.forEach((p, i) => {
      const x = startX + i * (NODE_W + COL_GAP);
      pos.set(p.id, { x, y });
      nodes.push({ person: p, x, y });
    });
  });

  // Parent → child edges (anchor at bottom-center of parent, top-center of child).
  const edges: LayoutEdge[] = [];
  relationships
    .filter((r) => r.type === 'parent')
    .forEach((r) => {
      const a = pos.get(r.person1Id);
      const b = pos.get(r.person2Id);
      if (!a || !b) return;
      edges.push({
        x1: a.x + NODE_W / 2,
        y1: a.y + NODE_H,
        x2: b.x + NODE_W / 2,
        y2: b.y,
      });
    });

  const height =
    PADDING * 2 + gens.length * NODE_H + (gens.length - 1) * ROW_GAP;

  return { nodes, edges, width: canvasWidth, height };
}
