// Service worker di Keter
// Strategia: network-first per i file dell'app (così gli aggiornamenti
// arrivano subito), cache-first per librerie CDN e font (stabili).
const CACHE = 'keter-v1';
const APP_SHELL = [
  './',
  './index.html',
  './data.js',
  './app.jsx',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mai intercettare le chiamate all'API Anthropic
  if (url.hostname === 'api.anthropic.com') return;

  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // Network-first: aggiornamenti immediati, cache come riserva offline
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
  } else {
    // CDN e font: cache-first (versioni fissate, non cambiano)
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
      )
    );
  }
});
