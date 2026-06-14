const CACHE_NAME = 'daycareduty-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=5',
  './app.js?v=5',
  './manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Never cache GitHub API sync traffic
  if (e.request.url.includes('api.github.com')) return;
  if (e.request.method !== 'GET') return;

  // Network-first so app updates reach installed PWAs; cache fallback for offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
