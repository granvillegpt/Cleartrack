// Service Worker for Cleartrack PWA - Rebuilt for Green Logo
const CACHE_NAME = 'cleartrack-green-v2024';
const STATIC_CACHE = 'cleartrack-static-v2024';
const DYNAMIC_CACHE = 'cleartrack-dynamic-v2024';

const urlsToCache = [
  '/',
  '/index.html',
  '/user-dashboard.html',
  '/practitioner-dashboard.html',
  '/shared-data.js',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192-new.png',
  '/icon-512-new.png'
];

// Install event - Force fresh cache
self.addEventListener('install', event => {
  console.log('Service Worker installing with green logo...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      // Delete all old caches
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Create new cache with green logo
      return caches.open(CACHE_NAME).then(cache => {
        console.log('Creating new cache with green logo');
        return cache.addAll(urlsToCache);
      });
    })
  );
});

// Fetch event - Network first for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // For HTML files, always try network first
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Update cache with fresh content
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request);
        })
    );
  }
  // For manifest and icons, always fetch fresh
  else if (url.pathname.includes('manifest.json') || url.pathname.includes('icon-')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
  // For other assets, cache first
  else {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(fetchResponse => {
            const responseClone = fetchResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
            return fetchResponse;
          });
        })
    );
  }
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating with green logo...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache during activation:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated with green logo');
      return self.clients.claim();
    })
  );
});

// Message event - Handle cache clearing
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});