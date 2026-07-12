/* Suimini — service worker : cache offline des assets statiques + API Supabase.
 *
 * Stratégies différenciées par type de requête (voir incident 2026-07-12 : des
 * déploiements rapprochés sans bump manuel de version avaient laissé des
 * clients avec un HTML en cache référençant des chunks JS/CSS d'un ancien
 * build → 404 sur les assets + crash de la navigation elle-même) :
 *   - Documents HTML (navigation)  → network-first. Le shell HTML ne doit
 *     JAMAIS être servi périmé pendant qu'internet fonctionne (il référence
 *     des noms de fichiers hashés qui peuvent disparaître d'un déploiement à
 *     l'autre) ; le cache ne sert que de secours hors-ligne.
 *   - /_next/static/*              → cache-first. Ces fichiers sont nommés
 *     par le hash de leur contenu (immuables par construction) : aucun risque
 *     à les garder en cache indéfiniment, l'URL change d'elle-même s'ils
 *     changent.
 *   - Supabase REST/Storage + reste même origine → stale-while-revalidate
 *     (comportement inchangé).
 *
 * Version de cache : injectée automatiquement au build Vercel avec le Build ID
 * Next.js (voir scripts/inject-sw-version.mjs + package.json "vercel-build")
 * — impossible à oublier de bumper. La valeur ci-dessous est le repli utilisé
 * en dev local (npm run build ne l'injecte pas).
 */
const CACHE = 'suimini-static-v8-dev';

// Assets statiques pré-mis en cache lors de l'installation.
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/icon-192.svg',
  '/icon-512.svg',
  '/og.svg',
  '/favicon.ico',
  // PWA shortcut icons
  '/icon-shortcut-tree.png',
  '/icon-shortcut-person.png',
  '/icon-shortcut-journal.png',
  '/icon-shortcut-share.png',
];

self.addEventListener('install', (event) => {
  // NB : pas de skipWaiting() ici — le nouveau SW ATTEND (état "waiting") au lieu
  // de prendre le contrôle en silence pendant qu'une page charge encore l'ancien
  // bundle. La bascule est déclenchée par l'utilisateur via le message SKIP_WAITING.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

// Bascule contrôlée : la page poste SKIP_WAITING (bouton « Actualiser ») pour
// activer le SW en attente, puis se recharge sur 'controllerchange'.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/** Cache-first : sert le cache s'il existe, sinon réseau (puis met en cache).
 *  Réservé aux ressources immuables (URL = hash du contenu). */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200 && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first : tente toujours le réseau d'abord, ne retombe sur le cache
 *  que si le réseau échoue vraiment (hors-ligne). Réservé au document HTML —
 *  jamais servir un shell périmé alors qu'internet fonctionne. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err; // vraiment hors-ligne et rien en cache → laisser le navigateur gérer
  }
}

/** Stale-while-revalidate : sert le cache immédiatement si présent, tout en
 *  rafraîchissant en arrière-plan. `basicOnly` évite de mettre en cache des
 *  réponses opaques cross-origin par erreur (sans objet pour Supabase, dont
 *  les réponses CORS ne sont jamais 'basic'). */
async function staleWhileRevalidate(request, { basicOnly = false } = {}) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && (!basicOnly || response.type === 'basic')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Laisser passer les non-GET sans interception.
  if (request.method !== 'GET') return;

  // ── API routes Next.js (/api/) : réseau uniquement, jamais de cache. ──
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // ── API REST Supabase (/rest/v1/) : stale-while-revalidate cross-origin. ──
  if (url.pathname.includes('/rest/v1/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ── Storage Supabase (/storage/v1/) : stale-while-revalidate cross-origin. ──
  if (url.pathname.includes('/storage/v1/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // ── Assets statiques Next.js hashés : immuables → cache-first. ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ── Document HTML (navigation) : network-first, jamais de shell périmé. ──
  const accept = request.headers.get('accept') || '';
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── Reste même origine (icônes, manifest, images…) : stale-while-revalidate. ──
  event.respondWith(staleWhileRevalidate(request, { basicOnly: true }));
});
