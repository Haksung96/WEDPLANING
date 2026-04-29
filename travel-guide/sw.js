// Service Worker — offline cache for app shell

const CACHE_NAME = 'wedplan-v4';
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
  './js/map.js',
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache Firebase / Google Maps API calls
  if (url.host.includes('googleapis.com') ||
      url.host.includes('gstatic.com') ||
      url.host.includes('firebaseio.com') ||
      url.host.includes('firestore.googleapis.com')) {
    return;
  }

  // Stale-while-revalidate for app shell
  if (event.request.method === 'GET' && url.origin === location.origin) {
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
  }
});
