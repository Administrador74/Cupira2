const CACHE_NAME = 'CupiraApp-cache-v2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://picsum.photos/seed/cupiraapp-red/192/192',
  'https://picsum.photos/seed/cupiraapp-red/512/512'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
