import { useEffect, useState } from 'react';
import { fetchMyRole, type TreeRole } from '@/lib/sharing';

/**
 * Effective role of the current user on the active tree.
 *
 * - Offline / guest / demo, or a tree the user OWNS  → 'owner' (full access).
 * - A tree shared WITH the user                       → resolved from the
 *   `my_tree_role` RPC ('admin' | 'editor' | 'viewer'), seeded synchronously
 *   from the legacy share permission so the UI never flashes the wrong gating.
 *
 * The whole app stays fully functional offline because the default is 'owner'.
 */
export function useTreeRole(opts: {
  treeId: string | null;
  cloud: boolean;
  /** True when the active tree is shared WITH the user (i.e. not owned). */
  isShared: boolean;
  /** Legacy hint from tree_shares: 'read' | 'write'. */
  sharedPermission?: string;
}): TreeRole {
  const { treeId, cloud, isShared, sharedPermission } = opts;

  const synchronousGuess = (): TreeRole =>
    !cloud || !isShared ? 'owner' : sharedPermission === 'write' ? 'editor' : 'viewer';

  const [role, setRole] = useState<TreeRole>(synchronousGuess);

  useEffect(() => {
    if (!cloud || !treeId || !isShared) { setRole('owner'); return; }
    let active = true;
    // Least-privilege default while the RPC resolves (seeded by legacy permission).
    setRole(sharedPermission === 'write' ? 'editor' : 'viewer');
    fetchMyRole(treeId).then(r => { if (active && r) setRole(r); });
    return () => { active = false; };
  }, [cloud, treeId, isShared, sharedPermission]);

  return role;
}
