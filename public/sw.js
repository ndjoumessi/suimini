/* Suimini — service worker v5 : cache offline des assets statiques + API Supabase.
 * v5 : bump pour livrer le bundle « getDataLayer runtime » (le v4 servait encore
 * l'ancien code build-time → le cookie suimini_data_layer n'était jamais lu). */
const CACHE = 'suimini-static-v5';

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
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // ── Storage Supabase (/storage/v1/) : stale-while-revalidate cross-origin. ──
  if (url.pathname.includes('/storage/v1/')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // ── Autres requêtes GET de même origine : stale-while-revalidate. ──
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
