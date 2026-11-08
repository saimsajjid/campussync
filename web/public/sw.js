// CampusSync Service Worker - Offline App Shell & Self-Hosted Fonts
const SHELL_CACHE = 'campussync-shell-v1';
const FONT_CACHE = 'campussync-fonts-v1';

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/fonts/inter.css',
  '/fonts/inter-latin.woff2',
];

// Paths that MUST NEVER be cached
const NEVER_CACHE_PREFIXES = [
  '/auth/',
  '/sync/',
  '/conflicts/',
  '/students/',
  '/admin/',
  '/demo/',
  '/events',
  '/health',
  '/api/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Pre-cache core shell resources
      for (const url of APP_SHELL_FILES) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] Failed to precache:', url, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE && key !== FONT_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Non-GET requests (POST, PUT, DELETE) -> Network ONLY, never cache
  if (req.method !== 'GET') {
    return;
  }

  // 2. Dynamic API endpoints -> Network ONLY, strictly never cached
  const isApi = NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  if (isApi) {
    return; // Passes directly to network without service worker caching
  }

  // 3. Fonts -> Cache-First Strategy
  if (url.pathname.includes('/fonts/') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          if (networkRes.ok) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 4. Navigation Requests (HTML / Page reload) -> Stale-While-Revalidate with index.html fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/', resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          // Offline fallback to cached app shell
          const cached = (await caches.match(req)) || (await caches.match('/')) || (await caches.match('/index.html'));
          if (cached) return cached;
          return new Response('CampusSync is offline. Cached shell not available.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 5. Static Assets (JS, CSS, SVGs, Images) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes.ok && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
