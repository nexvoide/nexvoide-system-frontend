// Service Worker for Nexvoide Management PWA
const CACHE_NAME = 'nexvoide-v7';
const RUNTIME_CACHE = 'nexvoide-runtime-v7';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/icon.png',
  '/icon-splash-1024.png',
  '/icon-512.png',
  '/icon-192.png',
  '/icon-144.png',
  '/logo.png',
  '/logo.svg',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching essential assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseToCache = response.clone();

        // Cache successful responses
        if (response.status === 200) {
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If it's a navigation request, return the cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }

          // Return a fallback response
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        });
      })
  );
});

// Background sync for offline actions (optional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks here
      Promise.resolve()
    );
  }
});

// Push notifications (optional)
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || 'New message' };
  }

  const options = {
    body: payload.body || 'New message',
    icon: '/icon-192.png',
    badge: '/icon-144.png',
    vibrate: [200, 100, 200],
    silent: false,
    renotify: true,
    tag: payload.tag || 'nexvoide-chat-message',
    timestamp: payload.timestamp || Date.now(),
    data: payload.data || { url: '/?tab=chat' },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Nexvoide Chat', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/?tab=chat';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existingClient = windowClients[0];
      if (existingClient) {
        return existingClient.focus().then(() => existingClient.navigate(targetUrl));
      }
      return clients.openWindow(targetUrl);
    })
  );
});
