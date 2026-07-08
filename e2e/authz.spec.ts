/**
 * Phase 0 — AuthZ, miroir EXACT des 29 policies RLS. Test le plus important de la
 * phase : une erreur ici = fuite inter-locataire. Table de vérité data-driven
 * (aucun navigateur), un faux provider en mémoire + un faux client Supabase.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import {
  canReadTreeContent, canWriteTreeContent, canReadJournal, isTreeOwner,
  canReadOwnProfile, isAdmin, isSuperAdmin,
  isPersonPubliclyVisible, isRelationshipPubliclyVisible,
  createSupabaseAuthzProvider,
  type AuthzDataProvider, type MaybeCaller,
} from '../src/lib/authz';

// ── Fixtures : un arbre privé et un arbre public, mêmes partages/membres ──────
const FIX: Record<string, { owner: string; public: boolean; shares: Record<string, 'read' | 'write'>; members: Record<string, 'pending' | 'accepted' | 'declined'> }> = {
  Tpriv: { owner: 'owner1', public: false, shares: { 'read@x': 'read', 'write@x': 'write' }, members: { macc: 'accepted', mpend: 'pending' } },
  Tpub: { owner: 'owner1', public: true, shares: { 'read@x': 'read', 'write@x': 'write' }, members: { macc: 'accepted', mpend: 'pending' } },
};

const provider: AuthzDataProvider = {
  async getTreeOwnerId(t) { return FIX[t]?.owner ?? null; },
  async getTreeSharePermission(t, email) { return FIX[t]?.shares[email] ?? null; },
  async getMembershipStatus(t, userId) { return FIX[t]?.members[userId] ?? null; },
  async isTreePublic(t) { return !!FIX[t]?.public; },
};

const C = {
  owner: { userId: 'owner1', email: 'owner@x', role: 'user' as const },
  shareRead: { userId: 'u_sr', email: 'read@x', role: 'user' as const },
  shareWrite: { userId: 'u_sw', email: 'write@x', role: 'user' as const },
  memberAcc: { userId: 'macc', email: 'macc@x', role: 'user' as const },
  memberPend: { userId: 'mpend', email: 'mpend@x', role: 'user' as const },
  stranger: { userId: 'stg', email: 'stg@x', role: 'user' as const },
  admin: { userId: 'adm', email: 'adm@x', role: 'admin' as const },
  anon: null as MaybeCaller,
};

// ── Table de vérité (■ = autorisé) ───────────────────────────────────────────
// readContent = persons/relationships ; writeContent = upsert/delete ;
// readJournal = journal ; owner = métadonnées/suppression d'arbre.
type Row = { caller: keyof typeof C; readContent: boolean; writeContent: boolean; readJournal: boolean; owner: boolean };

const PRIV: Row[] = [
  { caller: 'owner',      readContent: true,  writeContent: true,  readJournal: true,  owner: true  },
  { caller: 'shareRead',  readContent: true,  writeContent: false, readJournal: true,  owner: false },
  { caller: 'shareWrite', readContent: true,  writeContent: true,  readJournal: true,  owner: false },
  { caller: 'memberAcc',  readContent: true,  writeContent: false, readJournal: false, owner: false }, // membre = LECTURE SEULE, pas de journal
  { caller: 'memberPend', readContent: false, writeContent: false, readJournal: false, owner: false }, // invitation non acceptée
  { caller: 'stranger',   readContent: false, writeContent: false, readJournal: false, owner: false },
  { caller: 'admin',      readContent: false, writeContent: false, readJournal: false, owner: false }, // le rôle admin ne donne AUCUN accès aux données d'arbre
  { caller: 'anon',       readContent: false, writeContent: false, readJournal: false, owner: false },
];

// Arbre PUBLIC : seule la lecture de contenu s'ouvre à tous ; write/journal/owner inchangés.
const PUB: Row[] = PRIV.map(r => ({ ...r, readContent: true }));

for (const [treeId, table] of [['Tpriv', PRIV], ['Tpub', PUB]] as const) {
  for (const row of table) {
    test(`[${treeId}] ${row.caller}`, async () => {
      const caller = C[row.caller];
      expect(await canReadTreeContent(provider, treeId, caller)).toBe(row.readContent);
      expect(await canWriteTreeContent(provider, treeId, caller)).toBe(row.writeContent);
      expect(await canReadJournal(provider, treeId, caller)).toBe(row.readJournal);
      expect(await isTreeOwner(provider, treeId, caller)).toBe(row.owner);
    });
  }
}

// ── Profil / rôles ───────────────────────────────────────────────────────────
test('profil : lecture de soi uniquement', () => {
  expect(canReadOwnProfile(C.owner, 'owner1')).toBe(true);
  expect(canReadOwnProfile(C.owner, 'someone-else')).toBe(false);
  expect(canReadOwnProfile(C.anon, 'owner1')).toBe(false);
});
test('rôles admin', () => {
  expect(isAdmin(C.admin)).toBe(true);
  expect(isAdmin({ ...C.owner, role: 'superadmin' })).toBe(true);
  expect(isAdmin(C.owner)).toBe(false);
  expect(isAdmin(C.anon)).toBe(false);
  expect(isSuperAdmin(C.admin)).toBe(false);
  expect(isSuperAdmin({ ...C.owner, role: 'superadmin' })).toBe(true);
});

// ── Masquage lecture publique ────────────────────────────────────────────────
test('masque : fiche privée jamais exposée ; family/public le sont (miroir policy)', () => {
  expect(isPersonPubliclyVisible({ privacy: 'private' })).toBe(false);
  expect(isPersonPubliclyVisible({ privacy: 'public' })).toBe(true);
  expect(isPersonPubliclyVisible({ privacy: 'family' })).toBe(true); // coalesce(privacy,'public') <> 'private'
  expect(isPersonPubliclyVisible({})).toBe(true);
});
test('masque : relation cachée si l’un des deux liés est privé', () => {
  const persons = new Map<string, { privacy?: 'public' | 'private' | 'family' }>([
    ['a', { privacy: 'public' }], ['b', { privacy: 'private' }], ['c', {}],
  ]);
  expect(isRelationshipPubliclyVisible({ person1Id: 'a', person2Id: 'c' }, persons)).toBe(true);
  expect(isRelationshipPubliclyVisible({ person1Id: 'a', person2Id: 'b' }, persons)).toBe(false); // b privé
});

// ── Provider Phase 0 (option A) : lit les bons faits via le client Supabase ───
function fakeClient(rows: Record<string, any>) {
  const chain = (table: string) => {
    const filters: Record<string, any> = {};
    const c: any = {
      select: () => c,
      eq: (col: string, v: any) => { filters[col] = v; return c; },
      maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
    };
    return c;
  };
  return { from: (t: string) => chain(t) };
}

test('createSupabaseAuthzProvider : owner / share=write / membership / public', async () => {
  const client = fakeClient({
    trees: { owner_id: 'owner1', is_public: true },
    tree_shares: { permission: 'write' },
    tree_members: { status: 'accepted' },
  });
  const p = createSupabaseAuthzProvider(client);
  expect(await p.getTreeOwnerId('T')).toBe('owner1');
  expect(await p.getTreeSharePermission('T', 'x@y')).toBe('write');
  expect(await p.getMembershipStatus('T', 'u')).toBe('accepted');
  expect(await p.isTreePublic('T')).toBe(true);
});

test('createSupabaseAuthzProvider : absence de fait → null / false', async () => {
  const p = createSupabaseAuthzProvider(fakeClient({}));
  expect(await p.getTreeOwnerId('T')).toBe(null);
  expect(await p.getTreeSharePermission('T', 'x@y')).toBe(null);
  expect(await p.getMembershipStatus('T', 'u')).toBe(null);
  expect(await p.isTreePublic('T')).toBe(false);
});
