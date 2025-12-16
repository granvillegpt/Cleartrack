// Service Worker Registration with Cache Clearing
// Only register on app.cleartrack.co.za domain
if ('serviceWorker' in navigator && window.location.hostname === 'app.cleartrack.co.za') {
  // Unregister any existing service workers first
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister().then(function(success) {
        if (success) {
          console.log('Old service worker unregistered');
        }
      });
    }
  });

  // Register new service worker
  window.addEventListener('load', function() {
    // Prevent multiple registrations
    if (window.serviceWorkerRegistered) {
      return;
    }
    window.serviceWorkerRegistered = true;
    
    navigator.serviceWorker.register('/sw.js?v=5')
      .then(function(registration) {
        console.log('Service Worker registered:', registration);
        
        // Only check for updates once on initial load, not constantly
        // Remove immediate update check to prevent refresh loops
        // registration.update();
        
        // Don't check for updates on every visibility change - this causes refresh loops
        // Updates will happen naturally when the page is reloaded
        
        // Listen for updates - but don't auto-reload to prevent refresh loops
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, but don't auto-reload
                // User can manually refresh if needed, or it will activate on next visit
                console.log('New service worker available. It will activate on next page load or manual refresh.');
                // Don't reload automatically - this was causing refresh loops
              }
            });
          }
        });
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

