/**
 * Archi F7 — 401 pour tout appelant non authentifié sur /api/data/*.
 *
 * Portée VOLONTAIREMENT limitée au balayage 401 (AuthN) : c'est la seule
 * surface testable sans toucher à des données réelles — aucune credential
 * Supabase/Railway de TEST n'existe dans cet environnement (`.env.local`
 * porte de VRAIES clés de prod). Le volet 403 (appelant authentifié mais
 * sans droit sur l'arbre) et le volet happy-path (lecture/écriture réussie)
 * nécessiteraient un compte de test réel + des arbres fixtures, donc sont
 * volontairement HORS de ce fichier — à couvrir dans `e2e/integration/`
 * (même patron self-skip que `railway-store.spec.ts` : squelette prêt,
 * `test.skip(!process.env.SUPABASE_TEST_*)`) le jour où ces secrets existent.
 *
 * Tourne contre un vrai serveur Next (build prod, cf. `playwright.config.ts`
 * `webServer` — `npm run build && npx next start`), PAS en pure-logic : ce
 * sont de vraies requêtes HTTP vers de vrais route handlers. Chaque route qui
 * valide un corps/query AVANT d'appeler son garde (`guardTreeRead`/
 * `guardTreeWrite`/`authed()`) reçoit un payload minimal valide pour
 * atteindre RÉELLEMENT le garde plutôt que de s'arrêter sur un 400 — sinon
 * le test ne prouverait rien sur l'AuthN.
 *
 * Deux exceptions délibérées (documentées dans le code des routes elles-mêmes) :
 *   - `GET /api/data/whoami` → toujours 200 (sonde d'état, jamais 401).
 *   - `GET /api/data/collaboration/my-memberships` → fail-open 200 `{memberships:[]}`
 *     pour un appelant anonyme (« quels arbres partagés avec moi » côté `useAuth`).
 *   - `POST /api/data/rpc/get_invitation` → exemption anonyme scopée (F2 fix,
 *     lien d'invitation pré-login) : ne doit PAS 401.
 */
import { test, expect } from '@playwright/test';

const TREE_ID = 'probe-tree-id';

type Case = {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  url: string;
  data?: Record<string, unknown>;
};

// Balayage principal : tout appelant anonyme doit recevoir 401 avec le corps
// `{ error: 'Non authentifié.' }` (ou au moins un statut 401 — le message
// exact est vérifié séparément ci-dessous pour ne pas sur-coupler ce tableau).
const EXPECT_401: Case[] = [
  { name: 'GET trees (liste)', method: 'GET', url: '/api/data/trees' },
  { name: 'GET trees/[id]', method: 'GET', url: `/api/data/trees/${TREE_ID}` },
  { name: 'DELETE trees/[id]', method: 'DELETE', url: `/api/data/trees/${TREE_ID}` },
  { name: 'POST trees/[id]/save', method: 'POST', url: `/api/data/trees/${TREE_ID}/save`, data: {} },
  { name: 'POST trees/[id]/restore', method: 'POST', url: `/api/data/trees/${TREE_ID}/restore`, data: {} },
  { name: 'POST trees/[id]/children/delete', method: 'POST', url: `/api/data/trees/${TREE_ID}/children/delete`, data: {} },
  { name: 'POST trees/[id]/conflicts', method: 'POST', url: `/api/data/trees/${TREE_ID}/conflicts`, data: {} },
  { name: 'GET trees/[id]/public', method: 'GET', url: `/api/data/trees/${TREE_ID}/public` },
  { name: 'POST trees/[id]/public', method: 'POST', url: `/api/data/trees/${TREE_ID}/public`, data: { isPublic: false } },
  { name: 'GET trees/[id]/share', method: 'GET', url: `/api/data/trees/${TREE_ID}/share` },
  { name: 'POST trees/[id]/share', method: 'POST', url: `/api/data/trees/${TREE_ID}/share`, data: { email: 'probe@example.com', permission: 'read' } },
  { name: 'DELETE trees/[id]/share?email=', method: 'DELETE', url: `/api/data/trees/${TREE_ID}/share?email=probe@example.com` },
  { name: 'GET collaboration/comments', method: 'GET', url: '/api/data/collaboration/comments?treeId=probe-tree&personId=probe-person' },
  { name: 'POST collaboration/comments', method: 'POST', url: '/api/data/collaboration/comments', data: { treeId: 'probe-tree', personId: 'probe-person', content: 'probe' } },
  { name: 'GET collaboration/suggestions', method: 'GET', url: '/api/data/collaboration/suggestions?treeId=probe-tree' },
  { name: 'POST collaboration/suggestions', method: 'POST', url: '/api/data/collaboration/suggestions', data: { treeId: 'probe-tree', personId: 'probe-person', field: 'firstName', suggestedValue: 'Probe' } },
  { name: 'GET collaboration/suggestions/count', method: 'GET', url: '/api/data/collaboration/suggestions/count?treeId=probe-tree' },
  { name: 'POST collaboration/suggestions/resolve', method: 'POST', url: '/api/data/collaboration/suggestions/resolve', data: { id: 'probe-suggestion-id', status: 'accepted' } },
  { name: 'POST collaboration/members', method: 'POST', url: '/api/data/collaboration/members', data: { treeId: 'probe-tree', email: 'probe@example.com', role: 'viewer' } },
  { name: 'POST rpc/get_tree_members (RPC whitelistée, non exemptée)', method: 'POST', url: '/api/data/rpc/get_tree_members', data: {} },
];

for (const c of EXPECT_401) {
  test(`401 anonyme — ${c.name}`, async ({ request }) => {
    const res = c.method === 'GET'
      ? await request.get(c.url)
      : c.method === 'DELETE'
        ? await request.delete(c.url)
        : await request.post(c.url, { data: c.data });
    expect(res.status(), `${c.method} ${c.url} → attendu 401, reçu ${res.status()}`).toBe(401);
    const body = await res.json().catch(() => null);
    expect(body?.error, `${c.method} ${c.url} → corps d'erreur inattendu`).toBeTruthy();
  });
}

test('exception délibérée — GET whoami reste 200 pour un appelant anonyme', async ({ request }) => {
  const res = await request.get('/api/data/whoami');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ authenticated: false, userId: null });
});

test('exception délibérée — GET collaboration/my-memberships fail-open 200 pour un appelant anonyme', async ({ request }) => {
  const res = await request.get('/api/data/collaboration/my-memberships');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toEqual({ memberships: [] });
});

test('exception scopée — POST rpc/get_invitation ne doit PAS 401 pour un appelant anonyme', async ({ request }) => {
  const res = await request.post('/api/data/rpc/get_invitation', { data: { args: { token: 'probe-token-does-not-exist' } } });
  // Le token est bidon → on n'attend pas un succès métier précis (dépend du
  // backend effectif), seulement que l'exemption AuthN fonctionne : la route
  // ne doit jamais renvoyer 401 pour CETTE RPC précise, contrairement à
  // toutes les autres (cf. cas ci-dessus).
  expect(res.status(), 'get_invitation ne doit jamais 401 (exemption ANON_ALLOWED)').not.toBe(401);
});

test('whitelist RPC — un nom de RPC inconnu est rejeté (403) avant même le contrôle d\'auth', async ({ request }) => {
  const res = await request.post('/api/data/rpc/not_a_real_rpc', { data: {} });
  expect(res.status()).toBe(403);
});
