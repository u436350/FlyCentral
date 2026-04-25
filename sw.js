const BASE_PATH = '/FlyCentral';
const CACHE_NAME = 'flycentral-v3';
const STATIC_CACHE = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/icons/icon-192.png`,
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

  // Always try network first for navigation requests to avoid stale HTML shell.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(`${BASE_PATH}/index.html`, clone));
          return response;
        })
        .catch(() => caches.match(`${BASE_PATH}/index.html`))
    );
    return;
  }

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
      icon: `${BASE_PATH}/icons/icon-192.png`,
      badge: `${BASE_PATH}/icons/icon-192.png`,
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
