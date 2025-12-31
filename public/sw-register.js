// Service Worker Registration with Cache Clearing
// Only register on app.cleartrack.co.za domain
if ('serviceWorker' in navigator && window.location.hostname === 'app.cleartrack.co.za') {
  // Register new service worker immediately
  window.addEventListener('load', function() {
    // Prevent multiple registrations
    if (window.serviceWorkerRegistered) {
      return;
    }
    window.serviceWorkerRegistered = true;
    
    // Register service worker without timestamp - let the service worker's internal version handle updates
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Service Worker registered:', registration);
        
        // Check for updates immediately
        registration.update();
        
        // Listen for controller change (when new SW takes control)
        navigator.serviceWorker.addEventListener('controllerchange', function() {
          console.log('Service worker controller changed - reloading page');
          // Only reload if not on login page
          if (!window.location.pathname.includes('login.html')) {
            window.location.reload();
          }
        });
        
        // Listen for updates and force activation
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('New service worker found, waiting for installation...');
            
            newWorker.addEventListener('statechange', function() {
              console.log('New worker state:', newWorker.state);
              
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // There's a new service worker available
                  console.log('New service worker installed, requesting activation...');
                  
                  // Send message to new worker to skip waiting
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  
                  // Skip auto-reload on login page
                  if (window.location.pathname.includes('login.html')) {
                    console.log('New service worker available, but skipping auto-reload on login page');
                    return;
                  }
                  
                  // Wait a bit for activation, then reload
                  setTimeout(function() {
                    console.log('Reloading to use new service worker...');
                    window.location.reload();
                  }, 500);
                } else {
                  // First time installation
                  console.log('Service worker installed for the first time');
                }
              }
            });
          }
        });
        
        // Check for updates more frequently (every 10 seconds for faster updates)
        setInterval(function() {
          registration.update();
        }, 10 * 1000); // Check every 10 seconds
        
        // Also check when page becomes visible (user returns to tab)
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
            console.log('Page became visible, checking for service worker updates...');
            registration.update();
          }
        });
        
        // Check on focus (when user clicks on the app)
        window.addEventListener('focus', function() {
          console.log('Window focused, checking for service worker updates...');
          registration.update();
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

