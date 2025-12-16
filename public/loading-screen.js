/**
 * Shared Loading Screen Utility
 * Provides a consistent loading overlay across the application
 */

(function() {
  'use strict';
  
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
    try {
      const overlay = getOrCreateLoadingOverlay();
      if (!overlay) {
        console.error('[loading-screen] Cannot show - overlay not available');
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
      
      // Show overlay
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
      const overlay = document.getElementById('globalLoadingOverlay');
      if (overlay) {
        overlay.classList.remove('show');
        // Also hide with inline styles after transition
        setTimeout(() => {
          try {
            if (overlay && !overlay.classList.contains('show')) {
              overlay.style.display = 'none';
              overlay.style.visibility = 'hidden';
              overlay.style.opacity = '0';
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
