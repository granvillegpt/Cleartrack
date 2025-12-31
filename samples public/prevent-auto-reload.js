// Prevent automatic page reloads from service worker updates
(function() {
  'use strict';
  
  if ('serviceWorker' in navigator) {
    // Prevent service worker from causing automatic reloads
    let refreshing = false;
    
    // Override reload to prevent automatic refreshes
    const originalReload = window.location.reload;
    window.location.reload = function(forcedReload) {
      if (!forcedReload) {
        console.log('Automatic reload prevented');
        return;
      }
      return originalReload.call(this, forcedReload);
    };
    
    // Listen for service worker messages and prevent reloads
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data) {
        if (event.data.type === 'RELOAD' || event.data.type === 'SKIP_WAITING') {
          console.log('Service worker requested reload, but preventing it');
          event.stopImmediatePropagation();
          return false;
        }
      }
    });
    
    // Prevent controllerchange from triggering reloads
    navigator.serviceWorker.addEventListener('controllerchange', function(event) {
      if (!refreshing) {
        console.log('Service worker controller changed, but not reloading');
        // Don't reload automatically
      }
    });
    
    // Check if service worker is already registered and prevent update reloads
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.addEventListener('statechange', function() {
        if (this.state === 'activated' && !refreshing) {
          console.log('Service worker activated, but not reloading');
        }
      });
    }
  }
})();
