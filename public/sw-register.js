// Service Worker Registration with Safe Immediate Updates
// Only register on app.cleartrack.co.za domain
if ('serviceWorker' in navigator && window.location.hostname === 'app.cleartrack.co.za') {
  // ============================================
  // SAFETY MECHANISMS
  // ============================================
  
  // 1. Version tracking to prevent infinite loops
  let lastAppliedVersion = localStorage.getItem('swVersion') || '';
  let updateInProgress = false;
  let isReloading = false;
  let reloadTimeout = null;
  let lastUserActivity = Date.now();
  
  // 2. Safe page detection
  const SAFE_TO_RELOAD = [
    'dashboard.html',
    'user-dashboard.html',
    'practitioner-dashboard.html',
    'admin-dashboard.html',
    'index.html'
  ];
  
  const UNSAFE_TO_RELOAD = [
    'login.html',
    'onboarding.html',
    'register.html'
  ];
  
  function canSafelyReload() {
    const path = window.location.pathname.toLowerCase();
    const isSafe = SAFE_TO_RELOAD.some(safe => path.includes(safe));
    const isUnsafe = UNSAFE_TO_RELOAD.some(unsafe => path.includes(unsafe));
    return isSafe && !isUnsafe;
  }
  
  // 3. User activity detection
  function trackUserActivity() {
    ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(eventType => {
      document.addEventListener(eventType, () => {
        lastUserActivity = Date.now();
      }, { passive: true, once: false });
    });
  }
  
  function isUserIdle(minIdleSeconds = 5) {
    const idleSeconds = (Date.now() - lastUserActivity) / 1000;
    return idleSeconds >= minIdleSeconds;
  }
  
  function waitForIdle(callback, maxWaitSeconds = 30) {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isUserIdle(5)) {
        clearInterval(checkInterval);
        callback();
      } else if ((Date.now() - startTime) / 1000 >= maxWaitSeconds) {
        clearInterval(checkInterval);
        // Max wait reached, proceed anyway (user might be reading)
        callback();
      }
    }, 1000);
  }
  
  // 4. Safe reload function with debouncing
  function safeReload() {
    if (isReloading) {
      console.log('[sw] Reload already in progress, skipping');
      return;
    }
    
    if (reloadTimeout) {
      console.log('[sw] Reload already scheduled, skipping');
      return;
    }
    
    isReloading = true;
    console.log('[sw] Scheduling safe reload in 1 second...');
    
    reloadTimeout = setTimeout(() => {
      console.log('[sw] Performing safe reload...');
      window.location.reload();
    }, 1000);
  }
  
  // 5. Get service worker version from a specific worker
  function getServiceWorkerVersion(worker) {
    return new Promise((resolve) => {
      if (!worker) {
        resolve(null);
        return;
      }
      
      // Wait for worker to be ready (installed or activated state)
      if (worker.state === 'installing') {
        // Wait for installed state
        const stateHandler = () => {
          if (worker.state === 'installed' || worker.state === 'activated') {
            worker.removeEventListener('statechange', stateHandler);
            requestVersion();
          }
        };
        worker.addEventListener('statechange', stateHandler);
        return;
      }
      
      requestVersion();
      
      function requestVersion() {
        const channel = new MessageChannel();
        let timeout = setTimeout(() => {
          resolve(null); // Timeout after 1 second
        }, 1000);
        
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          if (event.data && event.data.version) {
            resolve(event.data.version);
          } else {
            resolve(null);
          }
        };
        
        try {
          worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        } catch (error) {
          clearTimeout(timeout);
          console.warn('[sw] Error getting version:', error);
          resolve(null);
        }
      }
    });
  }
  
  // 6. Perform safe update
  function performUpdate(registration, newVersion) {
    if (updateInProgress) {
      console.log('[sw] Update already in progress, skipping');
      return;
    }
    
    updateInProgress = true;
    console.log('[sw] Performing safe update to version:', newVersion);
    
    // Mark version as applied
    localStorage.setItem('swVersion', newVersion);
    
    // Request activation from new worker
    const newWorker = registration.installing || registration.waiting;
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Listen for controller change (when new SW takes control)
    const controllerChangeHandler = function() {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      console.log('[sw] Controller changed, new service worker is active');
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        safeReload();
      }, 300);
    };
    
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);
    
    // Fallback: if controller doesn't change within 5 seconds, reload anyway
    setTimeout(() => {
      if (!isReloading) {
        console.log('[sw] Controller change timeout, reloading anyway...');
        safeReload();
      }
    }, 5000);
  }
  
  // Start tracking user activity
  trackUserActivity();
  
  // Register service worker
  window.addEventListener('load', function() {
    // Prevent multiple registrations
    if (window.serviceWorkerRegistered) {
      return;
    }
    window.serviceWorkerRegistered = true;
    
    // Register service worker
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('[sw] Service Worker registered:', registration);
        
        // Get current version from active worker
        if (registration.active) {
          getServiceWorkerVersion(registration.active).then(currentVersion => {
            if (currentVersion && currentVersion !== lastAppliedVersion) {
              console.log('[sw] New version detected:', currentVersion, '(previous:', lastAppliedVersion, ')');
              // Version changed, but wait for updatefound event to handle it properly
            } else if (currentVersion) {
              console.log('[sw] Current version:', currentVersion);
              lastAppliedVersion = currentVersion;
            }
          });
        }
        
        // Check for updates immediately
        registration.update();
        
        // Listen for updates
        registration.addEventListener('updatefound', function() {
          const newWorker = registration.installing;
          if (!newWorker) return;
          
          console.log('[sw] New service worker found, waiting for installation...');
          
          newWorker.addEventListener('statechange', function() {
            console.log('[sw] New worker state:', newWorker.state);
            
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // There's a new service worker available
                console.log('[sw] New service worker installed');
                
                // Get the new version from the new worker
                getServiceWorkerVersion(newWorker).then(newVersion => {
                  if (!newVersion) {
                    // Fallback: use timestamp as version identifier
                    newVersion = Date.now().toString();
                    console.log('[sw] Could not get version from worker, using timestamp:', newVersion);
                  }
                  
                  // Safety check 1: Is this a new version?
                  if (lastAppliedVersion === newVersion) {
                    console.log('[sw] Already applied this version, skipping update');
                    return;
                  }
                  
                  // Safety check 2: Can we safely reload?
                  if (!canSafelyReload()) {
                    console.log('[sw] Update available but page is unsafe to reload:', window.location.pathname);
                    // Don't auto-reload on unsafe pages
                    // User will get update on next navigation
                    return;
                  }
                  
                  // Safety check 3: Is user idle?
                  if (!isUserIdle(5)) {
                    console.log('[sw] User is active, will reload when idle...');
                    // Wait for user to be idle, then update
                    waitForIdle(() => {
                      performUpdate(registration, newVersion);
                    }, 30); // Max 30 seconds wait
                    return;
                  }
                  
                  // All safety checks passed - perform update immediately
                  performUpdate(registration, newVersion);
                });
              } else {
                // First time installation
                console.log('[sw] Service worker installed for the first time');
                getServiceWorkerVersion(newWorker).then(version => {
                  if (version) {
                    localStorage.setItem('swVersion', version);
                    lastAppliedVersion = version;
                  }
                });
              }
            }
          });
        });
        
        // Check for updates periodically (every 10 seconds for faster updates)
        setInterval(function() {
          registration.update();
        }, 10 * 1000);
        
        // Also check when page becomes visible (user returns to tab)
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) {
            console.log('[sw] Page became visible, checking for updates...');
            registration.update();
          }
        });
        
        // Check on focus (when user clicks on the app)
        window.addEventListener('focus', function() {
          console.log('[sw] Window focused, checking for updates...');
          registration.update();
        });
      })
      .catch(function(error) {
        console.error('[sw] Service Worker registration failed:', error);
      });
  });

  // Clear all caches on page load (for development/testing)
  if (window.location.search.includes('clearcache=true')) {
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('[sw] Clearing cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      console.log('[sw] All caches cleared');
      localStorage.removeItem('swVersion');
      // Reload after clearing
      setTimeout(function() {
        window.location.reload();
      }, 500);
    });
  }
}
