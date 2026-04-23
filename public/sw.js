const CACHE_NAME = 'flycentral-v2';
const STATIC_CACHE = [
  '/',
  '/index.html',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_CACHE))
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
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.includes('/api/')) {
    // API: Network first, no cache
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"error":"Offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }
  // Static: Cache first
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      })
    )
  );
});

// Push notification handler
self.addEventListener('push', (e) => {
  let data = { title: '✈️ FlyCentral', body: 'Neue Benachrichtigung' };
  try { data = e.data?.json() || data; } catch {}
  
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'flycentral',
      requireInteraction: data.requireInteraction || false,
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.notification.data?.url) {
    e.waitUntil(clients.openWindow(e.notification.data.url));
  }
});
