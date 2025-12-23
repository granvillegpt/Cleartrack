/**
 * Unified Section Handler for All Dashboards
 * Provides consistent section switching across the entire application
 */

(function() {
    'use strict';

    // Unified showSection function that works across all dashboards
    window.showSection = function(sectionName, options = {}) {
        // Options can include: { updateNav: true, loadData: true, callback: function }
        const updateNav = options.updateNav !== false; // Default true
        const loadData = options.loadData !== false; // Default true
        
        // Hide all sections - support both .section and .admin-section classes
        document.querySelectorAll('.section, .admin-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section with null check
        let targetSection = document.getElementById(sectionName);
        
        // If not found, try with '-section' suffix (for admin dashboard)
        if (!targetSection) {
            targetSection = document.getElementById(sectionName + '-section');
        }
        
        if (targetSection) {
            targetSection.classList.remove('hidden');
        } else {
            console.warn(`Section '${sectionName}' not found`);
            return false;
        }
        
        // Update nav links if requested
        if (updateNav) {
            // Update .nav-link elements
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('data-section') === sectionName || 
                    link.getAttribute('href') === `#${sectionName}` ||
                    link.textContent.trim().toLowerCase() === sectionName.toLowerCase()) {
                    link.classList.add('active');
                }
            });
            
            // Update bottom nav items
            document.querySelectorAll('.bottom-nav-item').forEach(item => {
                const itemSection = item.getAttribute('data-section');
                if (itemSection === sectionName) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }
        
        // Load data if requested and section-specific loaders exist
        if (loadData) {
            // Dashboard-specific data loading
            if (sectionName === 'dashboard' && typeof updateDashboard === 'function') {
                updateDashboard();
            } else if (sectionName === 'messages' && typeof loadMessages === 'function') {
                loadMessages();
            } else if (sectionName === 'clients' && typeof loadClients === 'function') {
                loadClients();
            } else if (sectionName === 'tax-returns' && typeof loadTaxReturns === 'function') {
                loadTaxReturns();
            } else if (sectionName === 'invoices' && typeof loadInvoices === 'function') {
                loadInvoices();
            } else if (sectionName === 'connect' && typeof loadPractitionersDirectory === 'function') {
                loadPractitionersDirectory();
            } else if (sectionName === 'requests' && typeof loadConnectionRequests === 'function') {
                loadConnectionRequests();
            } else if (sectionName === 'support' && typeof loadSupportMessages === 'function') {
                loadSupportMessages();
            } else if (sectionName === 'applications' && typeof loadApplications === 'function') {
                loadApplications();
            }
        }
        
        // Call custom callback if provided
        if (options.callback && typeof options.callback === 'function') {
            options.callback(sectionName);
        }
        
        // Scroll to top of section
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        return true;
    };
    
    // Admin dashboard compatibility - map showAdminSection to showSection
    window.showAdminSection = function(section, buttonEl) {
        // Update nav active state for bottom nav
        if (buttonEl) {
            document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
            buttonEl.classList.add('active');
        }
        
        // Use unified showSection
        return window.showSection(section + '-section', {
            updateNav: false, // Already handled above
            loadData: true
        });
    };
    
    console.log('✅ Unified section handler initialized');
})();

