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
    navigator.serviceWorker.register('/sw.js?v=4')
      .then(function(registration) {
        console.log('Service Worker registered:', registration);
        
        // Check for updates immediately
        registration.update();
        
        // Force update on page visibility change
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
            registration.update();
          }
        });
        
        // Listen for updates
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, reload to activate
              console.log('New service worker available, reloading...');
              window.location.reload();
            }
          });
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

