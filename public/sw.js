// Service Worker for Cleartrack PWA - Updated for performance and stability
// Auto-versioning: Version is updated automatically via update-sw-version.js script
// Format: YYYYMMDD-HHMM (updates automatically on deploy)
// Run: node update-sw-version.js (or it runs automatically on deploy)
const CACHE_VERSION = '20251224-1026';
const CACHE_NAME = `cleartrack-v${CACHE_VERSION}`;
const STATIC_CACHE = `cleartrack-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `cleartrack-dynamic-v${CACHE_VERSION}`;

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
  console.log(`Service Worker installing with cache version: ${CACHE_VERSION}`);
  event.waitUntil(
    // Delete ALL old caches first (any cache not matching current version)
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Only delete caches that don't match current version
          if (!cacheName.includes(CACHE_VERSION)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      // Create new cache with current version
      return caches.open(CACHE_NAME).then(cache => {
        console.log(`Creating new cache: ${CACHE_NAME}`);
        // Use addAll but catch individual failures
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('[sw] Some resources failed to cache during install:', err);
          // Try to cache individually to see which ones fail
          return Promise.allSettled(
            urlsToCache.map(url => 
              cache.add(url).catch(err => {
                console.debug('[sw] Failed to cache:', url);
                return null; // Continue even if one fails
              })
            )
          );
        });
      });
    })
  );
  // Force activation immediately to use new cache version
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
  
  // CRITICAL: client-onboarding.html must NEVER be cached - always fetch fresh
  // This ensures practitioner redirects work immediately
  if (url.pathname.includes('client-onboarding.html')) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }).catch(() => {
        return new Response('Page unavailable', { status: 503 });
      })
    );
    return;
  }
  
  // For HTML files (especially dashboards with AI), ALWAYS fetch fresh from network - never use cache
  // This prevents showing old cached versions that don't have AI SDK initialization
  // CRITICAL: Dashboard files must always be fresh to ensure AI features work
  if (url.pathname.includes('dashboard.html') || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }).then(response => {
        // Don't cache HTML files - always fetch fresh
        return response;
      }).catch(() => {
        // Only fallback to cache if network completely fails
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            // If we have cached version, return it but also trigger a reload message
            console.warn('[sw] Serving cached HTML - user should refresh for latest version');
            return cachedResponse;
          }
          return new Response('Page unavailable', { status: 503 });
        });
      })
    );
    return;
  }
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
          if (response && response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then(cache => {
              cache.put(request, responseClone).catch(err => {
                // Silently fail cache updates
                console.debug('[sw] Cache update failed for manifest/icon:', url.pathname);
              });
            }).catch(() => {}); // Silently fail cache open
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).catch(() => {
            return new Response('Resource not available', { status: 404 });
          });
        })
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
              if (fetchResponse && fetchResponse.ok) {
                const responseClone = fetchResponse.clone();
                caches.open(DYNAMIC_CACHE).then(cache => {
                  cache.put(request, responseClone).catch(err => {
                    // Silently fail cache updates - don't spam console
                    console.debug('[sw] Cache update failed for image:', url.pathname);
                  });
                }).catch(() => {}); // Silently fail cache open
              }
            }).catch(() => {}); // Silently fail fetch
            return response;
          }
          // No cache, fetch from network
          return fetch(request).then(fetchResponse => {
            if (fetchResponse && fetchResponse.ok) {
              const responseClone = fetchResponse.clone();
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(request, responseClone).catch(err => {
                  // Silently fail cache updates
                  console.debug('[sw] Cache update failed for image:', url.pathname);
                });
              }).catch(() => {}); // Silently fail cache open
            }
            return fetchResponse;
          }).catch(err => {
            // Network error - return error response instead of throwing
            console.debug('[sw] Network error fetching image:', url.pathname);
            return new Response('Network error', { status: 503 });
          });
        })
    );
  }
  // For other assets, network first with cache fallback (don't cache failures)
  else {
    event.respondWith(
      fetch(request)
        .then(fetchResponse => {
          // Only cache successful GET requests
          if (request.method === 'GET' && fetchResponse && fetchResponse.ok && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            // Cache in background - don't wait for it
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone).catch(() => {
                // Silently fail - cache is optional
              });
            }).catch(() => {}); // Silently fail cache open
          }
          return fetchResponse;
        })
        .catch(fetchError => {
          // Network failed - try cache
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // No cache - return error
            return new Response('Network error and no cache available', { status: 503 });
          }).catch(() => {
            return new Response('Service unavailable', { status: 503 });
          });
        })
    );
  }
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log(`Service Worker activating with version: ${CACHE_VERSION} - cleaning old caches...`);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete caches that don't match current version
          if (!cacheName.includes(CACHE_VERSION)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      console.log(`Service Worker activated - using cache version: ${CACHE_VERSION}`);
      // Claim clients to immediately use new service worker
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