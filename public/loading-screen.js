/**
 * Shared Loading Screen Utility
 * Provides a consistent loading overlay across the application
 * Shows splash screen with background image and loading spinner
 */

(function() {
  'use strict';
  
  // Show splash screen immediately on script load (for dashboards)
  // This ensures it appears before DOMContentLoaded
  if (document.body && (window.location.pathname.includes('dashboard') || window.location.pathname.includes('login'))) {
    try {
      const overlay = document.getElementById('globalLoadingOverlay') || document.getElementById('loadingOverlay');
      if (!overlay) {
        // Create overlay immediately if it doesn't exist
        const tempOverlay = document.createElement('div');
        tempOverlay.id = 'globalLoadingOverlay';
        tempOverlay.className = 'loading-overlay';
        document.body.appendChild(tempOverlay);
      }
    } catch (e) {
      // Ignore - will be created properly in getOrCreateLoadingOverlay
    }
  }
  
  // Create loading overlay if it doesn't exist
  function getOrCreateLoadingOverlay() {
    let overlay = null;
    try {
      overlay = document.getElementById('globalLoadingOverlay');
    } catch (queryError) {
      console.error('[loading-screen] Error querying overlay:', queryError);
      return null;
    }
    
    if (!overlay) {
      try {
        overlay = document.createElement('div');
        overlay.id = 'globalLoadingOverlay';
        overlay.className = 'loading-overlay';
        // Set splash screen background based on screen size
        const isDesktop = window.innerWidth >= 768;
        const mobileImage = '/splash/Splash Screen cleartrack.png';
        const desktopImage = '/splash/Splash Screen Travel App Mobile Prototypes (1920 x 1080 px).png';
        
        overlay.innerHTML = `
          <div class="loading-spinner-wrapper" style="position: relative !important; width: 100px !important; height: 100px !important; margin: 0 auto 1.5rem !important; display: flex !important; align-items: center !important; justify-content: center !important;">
            <div class="loading-spinner" style="width: 100px !important; height: 100px !important; border: 4px solid #e5e7eb !important; border-top: 4px solid #0b7285 !important; border-radius: 50% !important; animation: spin 1s linear infinite !important; margin: 0 !important; position: absolute !important; top: 0 !important; left: 0 !important; background: transparent !important; z-index: 1 !important;"></div>
            <div class="loading-spinner-logo" id="globalLoadingLogo" style="position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 75px !important; height: 75px !important; z-index: 10 !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; background: transparent !important;">
              <img src="/assets/images/icon%20logo.png" alt="ClearTrack Logo" id="globalLoadingLogoImg" style="width: 100% !important; height: 100% !important; display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 10 !important; object-fit: contain !important; object-position: center center !important; border: none !important;" onerror="this.style.display='none';">
            </div>
          </div>
          <div class="loading-text" id="globalLoadingText">Loading...</div>
          <div class="loading-subtext" id="globalLoadingSubtext"></div>
        `;
        
        // Set background image after creating overlay
        overlay.style.backgroundImage = `url('${isDesktop ? desktopImage : mobileImage}')`;
        overlay.style.backgroundSize = 'cover';
        overlay.style.backgroundPosition = isDesktop ? 'center 25%' : 'center 30%';
        overlay.style.backgroundRepeat = 'no-repeat';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        overlay.style.backdropFilter = 'blur(1px)';
        overlay.style.webkitBackdropFilter = 'blur(1px)';
        
        // Store resize listener for cleanup
        const updateBackground = () => {
          const isDesktopNow = window.innerWidth >= 768;
          overlay.style.backgroundImage = `url('${isDesktopNow ? desktopImage : mobileImage}')`;
          overlay.style.backgroundPosition = isDesktopNow ? 'center 25%' : 'center 30%';
        };
        overlay._resizeListener = updateBackground;
        window.addEventListener('resize', updateBackground);
        if (document.body) {
          document.body.appendChild(overlay);
        } else {
          console.error('[loading-screen] Cannot create overlay - document.body not available');
          return null;
        }
      } catch (createError) {
        console.error('[loading-screen] Error creating overlay:', createError);
        return null;
      }
    } else {
      // Ensure logo exists even if overlay was already created
      try {
        const logoContainer = overlay.querySelector('#globalLoadingLogo') || overlay.querySelector('.loading-spinner-logo');
        const logoImg = overlay.querySelector('#globalLoadingLogoImg') || overlay.querySelector('#loadingLogoImg');
        if (!logoImg && logoContainer) {
          try {
            logoContainer.innerHTML = '<img src="/assets/images/icon%20logo.png" alt="ClearTrack Logo" id="globalLoadingLogoImg" onerror="this.style.display=\'none\';">';
          } catch (logoCreateError) {
            console.warn('[loading-screen] Error creating logo:', logoCreateError);
          }
        } else if (!logoContainer) {
          const wrapper = overlay.querySelector('.loading-spinner-wrapper');
          if (wrapper) {
            try {
              const newLogoContainer = document.createElement('div');
              newLogoContainer.className = 'loading-spinner-logo';
              newLogoContainer.id = 'globalLoadingLogo';
              newLogoContainer.style.cssText = 'position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 75px !important; height: 75px !important; z-index: 10 !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important;';
              newLogoContainer.innerHTML = '<img src="/assets/images/icon%20logo.png" alt="ClearTrack Logo" id="globalLoadingLogoImg" style="width: 100% !important; height: 100% !important; display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 10 !important; object-fit: contain !important;" onerror="this.style.display=\'none\';">';
              wrapper.appendChild(newLogoContainer);
            } catch (wrapperError) {
              console.warn('[loading-screen] Error adding logo to wrapper:', wrapperError);
            }
          }
        }
      } catch (logoCheckError) {
        console.warn('[loading-screen] Error checking logo:', logoCheckError);
        // Continue - logo is not critical
      }
    }
    return overlay;
  }
  
  /**
   * Show loading screen
   * @param {string} message - Main loading message
   * @param {string} submessage - Optional sub-message
   */
  window.showLoadingScreen = function(message = 'Loading...', submessage = '') {
    // Wait for body to be available if not ready yet
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          window.showLoadingScreen(message, submessage);
        });
        return;
      }
      // If DOMContentLoaded already fired, wait a bit for body
      setTimeout(() => {
        if (document.body) {
          window.showLoadingScreen(message, submessage);
        }
      }, 50);
      return;
    }
    
    try {
      const overlay = getOrCreateLoadingOverlay();
      if (!overlay) {
        console.warn('[loading-screen] Cannot show - overlay not available');
        return;
      }
      
      try {
        const textEl = document.getElementById('globalLoadingText');
        const subtextEl = document.getElementById('globalLoadingSubtext');
        
        if (textEl) textEl.textContent = message || 'Loading...';
        if (subtextEl) subtextEl.textContent = submessage || '';
      } catch (textError) {
        console.warn('[loading-screen] Error updating text:', textError);
      }
      
      // Ensure logo is visible (non-critical)
      try {
        const logoImg = overlay.querySelector('#globalLoadingLogoImg') || overlay.querySelector('#loadingLogoImg');
        const logoContainer = overlay.querySelector('#globalLoadingLogo') || overlay.querySelector('.loading-spinner-logo');
        if (logoImg) {
          logoImg.style.cssText = 'width: 100% !important; height: 100% !important; display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 10 !important; object-fit: contain !important; object-position: center center !important;';
        }
        if (logoContainer) {
          logoContainer.style.cssText = 'position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 75px !important; height: 75px !important; z-index: 10 !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important;';
        }
      } catch (logoError) {
        console.warn('[loading-screen] Error ensuring logo visibility:', logoError);
        // Continue - logo is not critical
      }
      
      // Show overlay - ensure splash screen background is applied
      try {
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.flexDirection = 'column';
        overlay.style.zIndex = '99999';
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
        
        // Ensure splash screen background is applied
        // Set background image based on screen size
        const isDesktop = window.innerWidth >= 768;
        const mobileImage = '/splash/Splash Screen cleartrack.png';
        const desktopImage = '/splash/Splash Screen Travel App Mobile Prototypes (1920 x 1080 px).png';
        overlay.style.backgroundImage = `url('${isDesktop ? desktopImage : mobileImage}')`;
        overlay.style.backgroundSize = 'cover';
        overlay.style.backgroundPosition = isDesktop ? 'center 25%' : 'center 30%';
        overlay.style.backgroundRepeat = 'no-repeat';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        overlay.style.backdropFilter = 'blur(1px)';
        overlay.style.webkitBackdropFilter = 'blur(1px)';
        
        // Update on window resize - store listener for cleanup
        const updateBackground = () => {
          const isDesktopNow = window.innerWidth >= 768;
          overlay.style.backgroundImage = `url('${isDesktopNow ? desktopImage : mobileImage}')`;
          overlay.style.backgroundPosition = isDesktopNow ? 'center 25%' : 'center 30%';
        };
        overlay._resizeListener = updateBackground;
        window.addEventListener('resize', updateBackground);
        
        overlay.classList.add('show');
      } catch (showError) {
        console.error('[loading-screen] Error showing overlay:', showError);
        // Fallback: just add the show class
        try {
          overlay.classList.add('show');
        } catch (fallbackError) {
          console.error('[loading-screen] Fallback also failed:', fallbackError);
        }
      }
    } catch (error) {
      console.error('[loading-screen] Critical error in showLoadingScreen:', error);
    }
  };
  
  /**
   * Hide loading screen
   */
  window.hideLoadingScreen = function() {
    try {
      // Try both global and local loading overlays
      const overlay = document.getElementById('globalLoadingOverlay') || document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.remove('show');
        // Also hide with inline styles after transition
        setTimeout(() => {
          try {
            if (overlay && !overlay.classList.contains('show')) {
              overlay.style.display = 'none';
              overlay.style.visibility = 'hidden';
              overlay.style.opacity = '0';
              // Remove resize listener if it exists
              if (overlay._resizeListener) {
                window.removeEventListener('resize', overlay._resizeListener);
                overlay._resizeListener = null;
              }
            }
          } catch (hideError) {
            console.warn('[loading-screen] Error hiding overlay:', hideError);
          }
        }, 300);
      }
    } catch (error) {
      console.error('[loading-screen] Error in hideLoadingScreen:', error);
    }
  };
  
  console.log('[loading-screen] Loading screen utility initialized');
})();
