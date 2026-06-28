import { FamilyTree, Person } from '@/types';
import { getParents, getChildren, getSpouses, getGeneration, getDisplayName } from '@/lib/treeUtils';

export const NODE_W = 140;
export const NODE_H = 64;
export const H_GAP = 20;
export const V_GAP = 84;

export interface LayoutNode {
  person: Person;
  x: number;
  y: number;
  /** The genealogical apex / pivot — flagged for the ✦ badge + amber accent. */
  isPivot: boolean;
  /** Member with no relation at all — rendered in a separate band, never dropped. */
  unattached: boolean;
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
  /** Top Y of each rendered generation row (for generation-aware pagination). */
  rowTops: number[];
  /** Dynamically-resolved root (pivot if set, else the most-connected founder). */
  pivotId: string | null;
  rootName: string;
  /** Number of generation rows actually rendered. */
  generations: number;
  unattachedCount: number;
}

/** Count of descendants reachable via parent→child edges (cycle-guarded). */
function descendantCount(id: string, childrenMap: Map<string, string[]>, memo: Map<string, number>): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  memo.set(id, 0); // guard against cyclic data
  let total = 0;
  for (const childId of childrenMap.get(id) ?? []) total += 1 + descendantCount(childId, childrenMap, memo);
  memo.set(id, total);
  return total;
}

/**
 * Generic, complete layout for the printable visual tree. Works for ANY tree
 * (1 to N members, single lineage or forest):
 *  - EVERY person in `tree.persons` is placed exactly once (no root-subtree drop).
 *  - Persons are bucketed by generation (depth from parentless roots); married-in
 *    spouses are aligned to their partner's generation so couples share a row.
 *  - Within a row, children cluster under their parents and spouses sit adjacent.
 *  - Members with no relation at all land in a separate "unattached" band.
 *  - The bounding box is computed AFTER placement (no fixed height that clips).
 * `rootId` is an optional preferred pivot; otherwise the founder (gen-0 person with
 * the most descendants) is used, so the result never depends on a specific tree.
 */
export function buildTreeLayout(tree: FamilyTree, rootId: string | null): TreeLayout {
  const persons = tree.persons;
  const rels = tree.relationships;
  const empty: TreeLayout = { nodes: [], edges: [], minX: 0, minY: 0, width: 0, height: 0, rowTops: [], pivotId: null, rootName: '', generations: 0, unattachedCount: 0 };
  if (!persons.length) return empty;

  const byId = new Map(persons.map(p => [p.id, p]));

  // 1) Generation by descent, then align spouses to the deeper of the couple.
  const genMemo = new Map<string, number>();
  const effGen = new Map<string, number>();
  for (const p of persons) effGen.set(p.id, getGeneration(p.id, rels, persons, genMemo));
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const r of rels) {
      if (r.type !== 'spouse' && r.type !== 'partner') continue;
      if (!byId.has(r.person1Id) || !byId.has(r.person2Id)) continue;
      const m = Math.max(effGen.get(r.person1Id) ?? 0, effGen.get(r.person2Id) ?? 0);
      if (effGen.get(r.person1Id) !== m) { effGen.set(r.person1Id, m); changed = true; }
      if (effGen.get(r.person2Id) !== m) { effGen.set(r.person2Id, m); changed = true; }
    }
    if (!changed) break;
  }

  // 2) Attached (in any relationship) vs unattached.
  const related = new Set<string>();
  for (const r of rels) { related.add(r.person1Id); related.add(r.person2Id); }
  const attached = persons.filter(p => related.has(p.id));
  const unattached = persons.filter(p => !related.has(p.id));

  // children map for clustering + descendant count
  const childrenMap = new Map<string, string[]>();
  for (const r of rels) {
    if (r.type !== 'parent') continue;
    const arr = childrenMap.get(r.person1Id) ?? [];
    arr.push(r.person2Id);
    childrenMap.set(r.person1Id, arr);
  }

  // 3) Resolve pivot/root generically.
  const dMemo = new Map<string, number>();
  const gen0 = attached.filter(p => (effGen.get(p.id) ?? 0) === 0);
  const founderPool = gen0.length ? gen0 : (attached.length ? attached : persons);
  let founder: Person | null = null;
  let best = -1;
  for (const p of founderPool) {
    const d = descendantCount(p.id, childrenMap, dMemo);
    if (d > best) { best = d; founder = p; }
  }
  const pivotPerson = (rootId && byId.get(rootId)) || founder || persons[0];
  const pivotId = pivotPerson ? pivotPerson.id : null;
  const rootName = pivotPerson ? getDisplayName(pivotPerson) : '';

  // 4) Order each generation: cluster children under parents, spouses adjacent.
  const byName = (a: Person, b: Person) =>
    (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || '');
  const maxGen = attached.length ? Math.max(...attached.map(p => effGen.get(p.id) ?? 0)) : 0;
  const placed = new Set<string>();
  const rows: Person[][] = [];
  let prev: Person[] = [];
  for (let g = 0; g <= maxGen; g++) {
    const row: Person[] = [];
    const pushWithSpouse = (p: Person) => {
      if (placed.has(p.id) || (effGen.get(p.id) ?? 0) !== g) return;
      placed.add(p.id);
      row.push(p);
      for (const sp of getSpouses(p.id, rels, persons)) {
        if (!placed.has(sp.id) && (effGen.get(sp.id) ?? 0) === g) { placed.add(sp.id); row.push(sp); }
      }
    };
    if (g === 0) {
      attached.filter(p => (effGen.get(p.id) ?? 0) === 0).sort(byName).forEach(pushWithSpouse);
    } else {
      for (const parent of prev) {
        for (const childId of childrenMap.get(parent.id) ?? []) {
          const c = byId.get(childId);
          if (c && (effGen.get(c.id) ?? 0) === g) pushWithSpouse(c);
        }
      }
      attached.filter(p => (effGen.get(p.id) ?? 0) === g && !placed.has(p.id)).sort(byName).forEach(pushWithSpouse);
    }
    rows[g] = row;
    prev = row;
  }

  // 5) Place rows (each centered), then the unattached band.
  const rowW = (row: Person[]) => (row.length ? row.length * (NODE_W + H_GAP) - H_GAP : 0);
  const attachedRows = rows.filter(r => r.length);
  const maxW = Math.max(rowW(unattached), NODE_W, ...attachedRows.map(rowW));
  const nodes: LayoutNode[] = [];
  const rowTops: number[] = [];
  let y = 0;
  for (const row of rows) {
    if (!row.length) continue;
    rowTops.push(y);
    let x = (maxW - rowW(row)) / 2;
    for (const p of row) { nodes.push({ person: p, x, y, isPivot: p.id === pivotId, unattached: false }); x += NODE_W + H_GAP; }
    y += NODE_H + V_GAP;
  }
  if (unattached.length) {
    if (attachedRows.length) y += V_GAP; // visual separation from the tree
    let x = (maxW - rowW(unattached)) / 2;
    for (const p of unattached) { nodes.push({ person: p, x, y, isPivot: false, unattached: true }); x += NODE_W + H_GAP; }
    y += NODE_H;
  }

  // Spine = "main lineage": pivot's ancestor chain (up via first parent) + main
  // descent (down via the child with the most descendants). Connectors along it
  // are accented in amber; all others stay neutral grey.
  const spine = new Set<string>();
  if (pivotId) {
    spine.add(pivotId);
    let up = pivotId;
    for (let i = 0; i < 500; i++) { const ps = getParents(up, rels, persons); if (!ps.length) break; up = ps[0].id; spine.add(up); }
    let down = pivotId;
    for (let i = 0; i < 500; i++) {
      const kids = childrenMap.get(down) ?? [];
      if (!kids.length) break;
      let bestK = kids[0], bestD = -1;
      for (const k of kids) { const d = descendantCount(k, childrenMap, dMemo); if (d > bestD) { bestD = d; bestK = k; } }
      down = bestK; spine.add(down);
    }
  }

  // 6) Edges from real positions.
  const pos = new Map(nodes.map(n => [n.person.id, n]));
  const edges: LayoutEdge[] = [];
  for (const r of rels) {
    if (r.type === 'parent') {
      const par = pos.get(r.person1Id);
      const ch = pos.get(r.person2Id);
      if (par && ch && !par.unattached && !ch.unattached) {
        const px = par.x + NODE_W / 2, py = par.y + NODE_H;
        const cx = ch.x + NODE_W / 2, cy = ch.y;
        const midY = (py + cy) / 2;
        const kind = spine.has(r.person1Id) && spine.has(r.person2Id) ? 'parent-main' : 'parent';
        edges.push({ x1: px, y1: py, x2: px, y2: midY, type: kind });
        edges.push({ x1: px, y1: midY, x2: cx, y2: midY, type: kind });
        edges.push({ x1: cx, y1: midY, x2: cx, y2: cy, type: kind });
      }
    } else if (r.type === 'spouse' || r.type === 'partner') {
      const a = pos.get(r.person1Id);
      const b = pos.get(r.person2Id);
      if (a && b && !a.unattached && !b.unattached && a.y === b.y) {
        const yMid = a.y + NODE_H / 2;
        edges.push({ x1: Math.min(a.x, b.x) + NODE_W, y1: yMid, x2: Math.max(a.x, b.x), y2: yMid, type: 'spouse' });
      }
    }
  }

  const PAD = 40;
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - PAD;
  const maxX = Math.max(...xs) + NODE_W + PAD;
  const minY = Math.min(...ys) - PAD;
  const maxY = y + PAD;
  return {
    nodes, edges,
    minX, minY, width: maxX - minX, height: maxY - minY,
    rowTops,
    pivotId, rootName,
    generations: attachedRows.length,
    unattachedCount: unattached.length,
  };
}

/** Dev validation: confirms every person is rendered (attached + unattached). */
export function validateVisualTree(tree: FamilyTree): {
  totalPersons: number;
  renderedNodes: number;
  unattachedNodes: number;
  pagesCount: number;
} {
  const L = buildTreeLayout(tree, tree.rootPersonId ?? null);
  return {
    totalPersons: tree.persons.length,
    renderedNodes: L.nodes.length,
    unattachedNodes: L.unattachedCount,
    pagesCount: 1,
  };
}
