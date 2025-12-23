// Service Worker Registration with Cache Clearing
// Register on all domains (Firebase hosting and custom domain)
if ('serviceWorker' in navigator) {
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
    
    // Auto-versioning: Use timestamp to force service worker update
    const swVersion = new Date().getTime(); // Timestamp ensures fresh registration
    navigator.serviceWorker.register(`/sw.js?v=${swVersion}`)
      .then(function(registration) {
        console.log('Service Worker registered:', registration);
        
        // Only check for updates once on initial load, not constantly
        // Remove immediate update check to prevent refresh loops
        // registration.update();
        
        // Don't check for updates on every visibility change - this causes refresh loops
        // Updates will happen naturally when the page is reloaded
        
        // Listen for updates and auto-reload when new version is ready
        // BUT: Don't auto-reload on login page to prevent refresh loops
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Skip auto-reload on login page
                if (window.location.pathname.includes('login.html')) {
                  console.log('New service worker available, but skipping auto-reload on login page');
                  return;
                }
                // New service worker available - reload to use it
                console.log('New service worker available. Reloading to use new version...');
                // Reload after a short delay to allow activation
                setTimeout(function() {
                  window.location.reload();
                }, 100);
              }
            });
          }
        });
        
        // Check for updates periodically (every 5 minutes)
        setInterval(function() {
          registration.update();
        }, 5 * 60 * 1000);
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

