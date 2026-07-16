/**
 * Archi F4 — l'AuthZ existe en 2 implémentations réelles (`createSupabaseAuthzProvider`
 * et `createRailwayAuthzProvider`, en plus des policies RLS et de la ré-implémentation
 * ad hoc dans `RailwayStore.loadTrees`/`canManageMembers`) sans test qui prouve que les
 * deux PROVIDERS se comportent IDENTIQUEMENT sur les mêmes faits. Depuis le 100%
 * Railway il n'y a plus de RLS en filet sur le chemin nominal : une divergence entre
 * providers serait une fuite inter-locataire directe, invisible tant qu'aucun test ne
 * la cherche.
 *
 * Ce test joue la MÊME fixture (celle d'`authz.spec.ts`) contre les deux providers RÉELS
 * (pas contre un troisième provider en mémoire comme `authz.spec.ts`) : un faux client
 * Supabase-style (`.from().select().eq().maybeSingle()`) et un faux `queryFn` SQL
 * (`createRailwayAuthzProvider(queryFn)`, injectable depuis le fix F4 — voir
 * railwayStore.ts) construits séparément mais représentant les MÊMES données. Toute
 * divergence de comportement entre les deux providers fait échouer ce test, sans
 * nécessiter de base Railway réelle (complète `e2e/integration/railway-store.spec.ts`,
 * qui reste la seule à taper une vraie base mais self-skip sans
 * `RAILWAY_TEST_DATABASE_URL`, absent des secrets CI — voir la note en bas de fichier).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  canReadTreeAsMember, canWriteTreeContent, canReadJournal, isTreeOwner,
  createSupabaseAuthzProvider, type AuthzDataProvider, type MaybeCaller,
} from '../src/lib/data/authz';
import { createRailwayAuthzProvider } from '../src/lib/data/railwayStore';

// ── Même fixture que e2e/authz.spec.ts (arbre privé + arbre public, mêmes
// partages/membres) — dupliquée ici plutôt que ré-exportée pour que ce test
// documente son propre jeu de données sans dépendance croisée fragile. ──────
const FIX: Record<string, { owner: string; public: boolean; shares: Record<string, 'read' | 'write'>; members: Record<string, 'pending' | 'accepted' | 'declined'> }> = {
  Tpriv: { owner: 'owner1', public: false, shares: { 'read@x': 'read', 'write@x': 'write' }, members: { macc: 'accepted', mpend: 'pending' } },
  Tpub: { owner: 'owner1', public: true, shares: { 'read@x': 'read', 'write@x': 'write' }, members: { macc: 'accepted', mpend: 'pending' } },
};

const CALLERS: MaybeCaller[] = [
  { userId: 'owner1', email: 'owner@x', role: 'user' },
  { userId: 'u_sr', email: 'read@x', role: 'user' },
  { userId: 'u_sw', email: 'write@x', role: 'user' },
  { userId: 'macc', email: 'macc@x', role: 'user' },
  { userId: 'mpend', email: 'mpend@x', role: 'user' },
  { userId: 'stg', email: 'stg@x', role: 'user' },
  { userId: 'adm', email: 'adm@x', role: 'admin' },
  null,
];

// ── Provider Supabase : faux client `.from(table).select().eq(col,v)...maybeSingle()` ──
function fakeSupabaseClient() {
  const chain = (table: string) => {
    const filters: Record<string, any> = {};
    const c: any = {
      select: () => c,
      eq: (col: string, v: any) => { filters[col] = v; return c; },
      maybeSingle: async () => {
        if (table === 'trees') {
          const t = FIX[filters.id];
          if (!t) return { data: null, error: null };
          return { data: { owner_id: t.owner, is_public: t.public }, error: null };
        }
        if (table === 'tree_shares') {
          const t = FIX[filters.tree_id];
          const perm = t?.shares[filters.shared_with_email];
          return { data: perm ? { permission: perm } : null, error: null };
        }
        if (table === 'tree_members') {
          const t = FIX[filters.tree_id];
          const status = t?.members[filters.user_id];
          return { data: status ? { status } : null, error: null };
        }
        return { data: null, error: null };
      },
    };
    return c;
  };
  return { from: (t: string) => chain(t) };
}

// ── Provider Railway : faux `queryFn` SQL, mêmes données que fakeSupabaseClient ──
function fakeRailwayQueryFn() {
  return async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
    const s = sql.toLowerCase();
    if (s.includes('from trees') && s.includes('owner_id') && !s.includes('is_public')) {
      const [treeId] = params as [string];
      const t = FIX[treeId];
      return (t ? [{ owner_id: t.owner }] : []) as T[];
    }
    if (s.includes('from trees') && s.includes('is_public')) {
      const [treeId] = params as [string];
      const t = FIX[treeId];
      return (t ? [{ is_public: t.public }] : []) as T[];
    }
    if (s.includes('from tree_shares')) {
      const [treeId, email] = params as [string, string];
      const t = FIX[treeId];
      const perm = t?.shares[email.toLowerCase()] ?? t?.shares[email];
      return (perm ? [{ permission: perm }] : []) as T[];
    }
    if (s.includes('from tree_members')) {
      const [treeId, userId] = params as [string, string];
      const t = FIX[treeId];
      const status = t?.members[userId];
      return (status ? [{ status }] : []) as T[];
    }
    throw new Error(`fakeRailwayQueryFn: requête non gérée — ${sql}`);
  };
}

const providers: Array<{ name: string; make: () => AuthzDataProvider }> = [
  { name: 'supabase', make: () => createSupabaseAuthzProvider(fakeSupabaseClient()) },
  { name: 'railway', make: () => createRailwayAuthzProvider(fakeRailwayQueryFn()) },
];

for (const treeId of ['Tpriv', 'Tpub'] as const) {
  for (const caller of CALLERS) {
    const label = caller ? caller.userId : 'anon';
    test(`parité providers [${treeId}] ${label}`, async () => {
      const results = await Promise.all(providers.map(async ({ name, make }) => {
        const p = make();
        return {
          name,
          read: await canReadTreeAsMember(p, treeId, caller),
          write: await canWriteTreeContent(p, treeId, caller),
          journal: await canReadJournal(p, treeId, caller),
          owner: await isTreeOwner(p, treeId, caller),
        };
      }));
      const [a, b] = results;
      expect(b.read, `canReadTreeAsMember diverge entre ${a.name} et ${b.name}`).toBe(a.read);
      expect(b.write, `canWriteTreeContent diverge entre ${a.name} et ${b.name}`).toBe(a.write);
      expect(b.journal, `canReadJournal diverge entre ${a.name} et ${b.name}`).toBe(a.journal);
      expect(b.owner, `isTreeOwner diverge entre ${a.name} et ${b.name}`).toBe(a.owner);
    });
  }
}

/**
 * NOTE (non automatisable depuis cet agent) : `e2e/integration/railway-store.spec.ts`
 * teste `RailwayStore` contre une VRAIE base Railway mais self-skip sans
 * `RAILWAY_TEST_DATABASE_URL` — ce secret n'est pas dans `.github/workflows/
 * integration-tests.yml` (qui ne passe que les 3 `SUPABASE_TEST_*`). L'ajouter
 * demande un accès aux settings GitHub du repo (Secrets and variables → Actions),
 * hors de portée de cet agent. Ce test-ci (parité pure-logic) couvre la régression
 * la plus probable (divergence de LOGIQUE entre providers) sans ce secret ; il ne
 * remplace pas un test contre le SQL réel (typo de nom de colonne, etc.).
 */
