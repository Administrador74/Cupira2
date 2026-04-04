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

// Manejador de Notificaciones en Segundo Plano (Push)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {
    title: 'Nueva Notificación',
    body: 'Tienes una nueva actualización en Cupira Conectada.'
  };

  const options = {
    body: data.body,
    icon: 'https://picsum.photos/seed/cupiraapp-red/192/192',
    badge: 'https://picsum.photos/seed/cupiraapp-red/192/192',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Abrir la app al hacer clic en la notificación
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
