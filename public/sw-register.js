// Service Worker Registration for PWA
// Register on all domains (Firebase hosting and custom domain)
if ('serviceWorker' in navigator) {
  // Register service worker
  window.addEventListener('load', function() {
    // Prevent multiple registrations
    if (window.serviceWorkerRegistered) {
      return;
    }
    window.serviceWorkerRegistered = true;
    
    // Register service worker (version is handled by sw.js itself)
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Service Worker registered:', registration);
        
        // Listen for updates but DON'T auto-reload to prevent loops
        // Users can manually refresh if needed
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Don't auto-reload - this causes loops on PWA installations
                // Just log that an update is available
                console.log('New service worker available. It will activate on next page load.');
              }
            });
          }
        });
        
        // Check for updates periodically (every 10 minutes) but don't force reload
        setInterval(function() {
          registration.update().catch(function(err) {
            console.log('Service Worker update check failed:', err);
          });
        }, 10 * 60 * 1000);
      })
      .catch(function(error) {
        console.log('Service Worker registration failed:', error);
      });
  });

  // Clear all caches on page load (for development/testing)
  if (window.location.search.includes('clearcache=true')) {
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      console.log('All caches cleared');
      // Reload after clearing
      setTimeout(function() {
        window.location.reload();
      }, 500);
    });
  }
}

