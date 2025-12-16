/**
 * GLOBAL HAMBURGER MENU COMPONENT
 * Single source of truth for hamburger menu across entire app
 * Auto-initializes on any page that includes this script
 */

(function() {
    'use strict';

    // Global toggleMenu function - works with style parameter
    // Define immediately so it's available for onclick handlers
    let isToggling = false;
    
    window.toggleMenu = function(style, event) {
        // Prevent double-toggling
        if (isToggling) {
            console.log('Toggle blocked: already toggling');
            return;
        }
        
        isToggling = true;
        
        // Prevent event from bubbling if provided
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        
        // Support both ID systems: nav-style6 (old) and ctMainNav (new)
        const navElement = document.getElementById(`nav-style${style.slice(-1)}`) || document.getElementById('ctMainNav');
        const toggleElement = document.querySelector(`.menu-toggle-style${style.slice(-1)}`) || document.getElementById('ctMenuToggle');
        const overlay = document.getElementById(`overlay-style${style.slice(-1)}`);
        
        if (!navElement) {
            console.warn(`Global hamburger menu: nav-style${style.slice(-1)} not found`);
            isToggling = false;
            return;
        }
        
        // Toggle active state
        const wasActive = navElement.classList.contains('active');
        const isNowActive = !wasActive;
        navElement.classList.toggle('active');
        if (toggleElement) {
            toggleElement.classList.toggle('active');
            toggleElement.setAttribute('aria-expanded', isNowActive ? 'true' : 'false');
        }
        if (overlay) {
            overlay.classList.toggle('active');
        }
        
        // Calculate position relative to header and ensure no clipping
        if (!wasActive) {
            // Opening menu - calculate position
            const header = toggleElement?.closest('.header');
            if (header) {
                const headerRect = header.getBoundingClientRect();
                const headerBottom = headerRect.bottom;
                const viewportWidth = window.innerWidth;
                const margin = 16; // 1rem = 16px
                
                // Override any conflicting inline styles with !important via cssText
                navElement.style.cssText += `
                    position: fixed !important;
                    top: ${headerBottom + 8}px !important;
                    right: ${margin}px !important;
                    left: auto !important;
                    max-width: min(280px, ${viewportWidth - (margin * 2)}px) !important;
                    width: auto !important;
                    min-width: 220px !important;
                    box-sizing: border-box !important;
                `;
                
                // Force a reflow to get actual menu width
                navElement.offsetHeight;
                
                // Check if menu overflows and adjust if needed
                const menuRect = navElement.getBoundingClientRect();
                if (menuRect.right > viewportWidth - margin) {
                    // Menu is overflowing - adjust right position
                    const overflow = menuRect.right - (viewportWidth - margin);
                    const newRight = margin + overflow;
                    navElement.style.right = newRight + 'px';
                }
                
                // Debug logging
                console.log('Menu positioning:', {
                    viewportWidth,
                    menuWidth: menuRect.width,
                    menuRight: menuRect.right,
                    menuLeft: menuRect.left,
                    rightStyle: navElement.style.right,
                    maxWidth: getComputedStyle(navElement).maxWidth,
                    overflow: menuRect.right > viewportWidth - margin
                });
            }
        } else {
            // Closing menu - reset inline styles (let CSS handle it)
            navElement.style.top = '';
            navElement.style.right = '';
            navElement.style.maxWidth = '';
            navElement.style.minWidth = '';
            navElement.style.width = '';
            navElement.style.left = '';
        }
        
        // Force a reflow to ensure CSS is applied
        navElement.offsetHeight;
        
        // Reset toggle flag after CSS transition completes
        setTimeout(function() {
            isToggling = false;
            
            // Debug logging after CSS has been applied
            const computedStyle = window.getComputedStyle(navElement);
            const isNowActive = navElement.classList.contains('active');
            console.log(`Hamburger menu ${wasActive ? 'closed' : 'opened'}. Final state:`, {
                navActive: isNowActive,
                toggleActive: toggleElement ? toggleElement.classList.contains('active') : 'N/A',
                overlayActive: overlay ? overlay.classList.contains('active') : 'N/A',
                display: computedStyle.display,
                maxHeight: computedStyle.maxHeight,
                opacity: computedStyle.opacity,
                visibility: computedStyle.visibility,
                pointerEvents: computedStyle.pointerEvents,
                position: computedStyle.position,
                top: computedStyle.top,
                right: computedStyle.right,
                zIndex: computedStyle.zIndex
            });
        }, 350); // Wait for CSS transition (0.3s)
    };

    // Wait for DOM to be ready
    function initGlobalHamburgerMenu() {
        // Find the hamburger menu toggle button
        const menuToggle = document.getElementById('menuToggle');
        const nav = document.getElementById('nav-style6');

        if (!menuToggle || !nav) {
            console.warn('Global hamburger menu: Required elements not found (menuToggle or nav-style6)');
            // Don't return - still set up event listeners
        }

        // Backward compatibility wrapper
        window.toggleMenuStyle6 = function() {
            window.toggleMenu('style6');
        };

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            // Skip if we're currently toggling
            if (isToggling) {
                return;
            }
            
            const navElement = document.getElementById('nav-style6') || document.getElementById('ctMainNav');
            const toggleElement = document.querySelector('.menu-toggle-style6') || document.getElementById('ctMenuToggle');
            const header = toggleElement?.closest('.header');
            
            // Don't close if clicking the toggle button itself
            if (event.target === toggleElement || toggleElement?.contains(event.target)) {
                return;
            }
            
            // Don't close if clicking inside the nav menu
            if (navElement && navElement.contains(event.target)) {
                return;
            }
            
            // Close menu if clicking outside header
            // Use setTimeout to ensure this runs AFTER onclick handlers
            setTimeout(function() {
                if (navElement && navElement.classList.contains('active')) {
                    if (header && !header.contains(event.target)) {
                        navElement.classList.remove('active');
                        if (toggleElement) toggleElement.classList.remove('active');
                    }
                }
            }, 10);
        });

        // Close menu when pressing Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                const navElement = document.getElementById('nav-style6') || document.getElementById('ctMainNav');
                const toggleElement = document.querySelector('.menu-toggle-style6') || document.getElementById('ctMenuToggle');
                if (navElement && navElement.classList.contains('active')) {
                    navElement.classList.remove('active');
                    if (toggleElement) toggleElement.classList.remove('active');
                }
            }
        });

        // Close menu when window is resized to desktop size
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                const navElement = document.getElementById('nav-style6') || document.getElementById('ctMainNav');
                const toggleElement = document.querySelector('.menu-toggle-style6') || document.getElementById('ctMenuToggle');
                if (navElement && navElement.classList.contains('active')) {
                    navElement.classList.remove('active');
                    if (toggleElement) toggleElement.classList.remove('active');
                }
            }
        });

        // Global handleNavClick function - handles all navigation
        const originalHandleNavClick = window.handleNavClick;
        
        window.handleNavClick = function(sectionName, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            // Close mobile menu first - support both ID systems
            const navElement = document.getElementById('nav-style6') || document.getElementById('ctMainNav');
            const toggleElement = document.querySelector('.menu-toggle-style6') || document.getElementById('ctMenuToggle');
            if (navElement && navElement.classList.contains('active')) {
                navElement.classList.remove('active');
                if (toggleElement) toggleElement.classList.remove('active');
            }

            // Update active state for ALL nav links
            document.querySelectorAll('.nav-link, .nav a, .nav-style6 a').forEach(link => {
                link.classList.remove('active');
            });

            // Get the clicked element
            let clickedLink = event ? (event.target || event.currentTarget) : null;
            if (clickedLink && !clickedLink.classList.contains('nav-link')) {
                clickedLink = clickedLink.closest('.nav-link') || clickedLink.closest('a');
            }

            // Activate the clicked link
            if (clickedLink) {
                clickedLink.classList.add('active');
                
                // Also activate corresponding link by matching onclick attribute
                const clickedOnclick = clickedLink.getAttribute('onclick');
                if (clickedOnclick) {
                    document.querySelectorAll('.nav-link, .nav a, .nav-style6 a').forEach(link => {
                        if (link.getAttribute('onclick') === clickedOnclick) {
                            link.classList.add('active');
                        }
                    });
                }
            } else {
                // Fallback: find link by section name
                document.querySelectorAll('.nav-link, .nav a, .nav-style6 a').forEach(link => {
                    const onclick = link.getAttribute('onclick');
                    if (onclick && onclick.includes("'" + sectionName + "'")) {
                        link.classList.add('active');
                    }
                });
            }

            // Call dashboard-specific navigation handler if it exists
            // This allows each dashboard to have custom logic (like showSection, loadData, etc.)
            if (originalHandleNavClick && typeof originalHandleNavClick === 'function') {
                // Pass through to dashboard-specific handler for custom logic
                return originalHandleNavClick.call(this, sectionName, event);
            } else if (window.showSection && typeof window.showSection === 'function') {
                // If showSection exists (common in dashboards), call it
                window.showSection(sectionName);
            } else {
                // Fallback
                document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
                const t = document.getElementById(sectionName);
                if (t) t.classList.remove("hidden");
            }

            // Close mobile nav after clicking - support both ID systems
            // Try new IDs first (ctMainNav/ctMenuToggle), then fall back to old IDs (nav-style6/menuToggle)
            let nav = document.getElementById("ctMainNav") || document.getElementById("nav-style6");
            let toggle = document.getElementById("ctMenuToggle") || document.getElementById("menuToggle") || document.querySelector(".menu-toggle-style6");

            if (nav && toggle) {
                nav.classList.remove("active");
                toggle.classList.remove("active");
                if (toggle.setAttribute) {
                    toggle.setAttribute("aria-expanded", "false");
                }
            }
        };

        console.log('Global hamburger menu and navigation initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobalHamburgerMenu);
    } else {
        initGlobalHamburgerMenu();
    }
})();

