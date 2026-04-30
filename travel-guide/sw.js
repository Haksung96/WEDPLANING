// Service Worker — offline cache for app shell

const CACHE_NAME = 'wedplan-v9';
const APP_SHELL = [
  './',
  './index.html',
  './install.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/settings.js',
  './js/data.js',
  './js/phrases.js',
  './js/sync.js',
  './js/checklist.js',
  './js/expenses.js',
  './js/weather.js',
  './js/presence.js',
  './js/reboarding.js',
  './js/map.js',
  './js/directions.js',
  './js/event-editor.js',
  './js/mobile.js',
  './js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('SW install partial:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Files that should always come from network when online (so changes apply
// on the very next reload instead of the second reload).
const NETWORK_FIRST = ['/js/config.js', '/index.html', '/'];

function isNetworkFirst(url) {
  return NETWORK_FIRST.some((p) => url.pathname === p || url.pathname.endsWith(p));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache Firebase / Google Maps API calls
  if (url.host.includes('googleapis.com') ||
      url.host.includes('gstatic.com') ||
      url.host.includes('firebaseio.com') ||
      url.host.includes('firestore.googleapis.com')) {
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== location.origin) return;

  // Network-first for config and app shell entry — keeps fresh keys/HTML.
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-while-revalidate for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
