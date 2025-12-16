// Service Worker for Cleartrack PWA - Updated for performance and stability
const CACHE_NAME = 'cleartrack-v2024-24';
const STATIC_CACHE = 'cleartrack-static-v2024-24';
const DYNAMIC_CACHE = 'cleartrack-dynamic-v2024-24';

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
  // Allow service worker to activate, but don't claim clients immediately
  // This prevents refresh loops while still allowing activation
  self.skipWaiting();
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
  
  // For HTML files, ALWAYS fetch fresh from network - never use cache
  // This prevents showing old cached versions on first click
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(response => {
        // Don't cache HTML files at all - always get fresh
        return response;
      }).catch(() => {
        // If network fails completely, try cache as last resort
        return caches.match(request).then(cached => {
          if (cached) {
            // Even if we use cache, add a timestamp to force refresh
            return cached;
          }
          // No cache available - return network error
          return new Response('Network error and no cache available', { status: 503 });
        });
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
  // For CSS files, ALWAYS fetch fresh from network - never use cache
  // This ensures CSS updates are immediately visible
  else if (url.pathname.endsWith('.css') || request.headers.get('accept')?.includes('text/css')) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store', 
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        } 
      }).then(response => {
        // Don't cache CSS at all - always fresh
        return response;
      }).catch(() => {
        // If network fails, try cache as last resort but add timestamp
        return caches.match(request).then(cached => {
          if (cached) {
            // Return cached but with no-cache headers
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers: {
                ...Object.fromEntries(cached.headers),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            });
          }
          return cached;
        });
      })
    );
    return;
  }
  // For critical JS files (login.js, dashboard-auth.js, etc), ALWAYS fetch fresh - never cache
  // This prevents stale code from causing issues
  else if (url.pathname.endsWith('.js') && (
    url.pathname.includes('login.js') || 
    url.pathname.includes('dashboard-auth.js') || 
    url.pathname.includes('loading-screen.js') ||
    url.pathname.includes('firebase-init.js')
  )) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store', 
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        } 
      }).then(response => {
        // Don't cache critical JS files - always fresh
        return response;
      }).catch(() => {
        // If network fails, try cache as last resort
        return caches.match(request).then(cached => {
          if (cached) {
            // Return cached but with no-cache headers
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers: {
                ...Object.fromEntries(cached.headers),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            });
          }
          return cached;
        });
      })
    );
    return;
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
      // Don't claim clients immediately - let them continue naturally
      // This prevents refresh loops
      // return self.clients.claim();
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