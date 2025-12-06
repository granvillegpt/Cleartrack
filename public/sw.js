// Service Worker for Cleartrack PWA - Updated for performance and stability
const CACHE_NAME = 'cleartrack-v2024-22';
const STATIC_CACHE = 'cleartrack-static-v2024-22';
const DYNAMIC_CACHE = 'cleartrack-dynamic-v2024-22';

const urlsToCache = [
  '/',
  '/index.html',
  '/user-dashboard.html',
  '/practitioner-dashboard.html',
  '/shared-data.js',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  // Include all icon sizes
  '/icons/cleartrack-72.png',
  '/icons/cleartrack-96.png',
  '/icons/cleartrack-128.png',
  '/icons/cleartrack-144.png',
  '/icons/cleartrack-152.png',
  '/icons/cleartrack-192.png',
  '/icons/cleartrack-384.png',
  '/icons/cleartrack-512.png',
  '/icons/cleartrack-512-maskable.png'
];

// Install event - Force fresh cache
self.addEventListener('install', event => {
  console.log('Service Worker installing with updated icons...');
  event.waitUntil(
    // Delete ALL old caches first
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Create new cache with updated icons
      return caches.open(CACHE_NAME).then(cache => {
        console.log('Creating new cache with updated icons');
        return cache.addAll(urlsToCache);
      });
    })
  );
  // Force activation of new service worker (but don't reload pages)
  self.skipWaiting();
  // Don't claim clients immediately to prevent reloads
  // self.clients.claim() will be called in activate event
});

// Fetch event - Stale-while-revalidate for HTML to prevent flickering
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Never cache or serve fix-inline.js, inject-fix.js, or any fix files - return 404 immediately
  if (url.pathname.includes('fix-inline.js') || url.pathname.includes('inject-fix.js') || url.pathname.includes('practitioner-code-fix.js')) {
    event.respondWith(new Response('', { status: 404, statusText: 'Not Found' }));
    return;
  }
  
  // For HTML files, use stale-while-revalidate to prevent flickering
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        // Return cached version immediately if available
        const fetchPromise = fetch(request).then(response => {
          // Update cache with fresh content in background
          if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          }
          return response;
        }).catch(() => null); // Silently fail if network unavailable
        
        // Return cached version immediately, or wait for network if no cache
        return cachedResponse || fetchPromise;
        })
    );
  }
  // For manifest and icons, always fetch fresh (network first, no cache)
  else if (url.pathname.includes('manifest.json') || url.pathname.includes('/icons/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          // Update cache but always return fresh from network
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
  // For images and other assets, cache first with network fallback
  else if (request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // Return cached image immediately, update in background
            fetch(request).then(fetchResponse => {
              if (fetchResponse.ok) {
                const responseClone = fetchResponse.clone();
                caches.open(DYNAMIC_CACHE).then(cache => {
                  cache.put(request, responseClone);
                });
              }
            }).catch(() => {}); // Silently fail
            return response;
          }
          // No cache, fetch from network
          return fetch(request).then(fetchResponse => {
            if (fetchResponse.ok) {
              const responseClone = fetchResponse.clone();
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return fetchResponse;
          });
        })
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
            // Only cache GET requests, not POST/PUT/DELETE
            if (request.method === 'GET' && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
            }
            return fetchResponse;
          });
        })
    );
  }
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating - clearing ALL old caches...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete ALL old caches to force fresh load
          console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Service Worker activated - all caches cleared');
      // Take control of all clients immediately
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