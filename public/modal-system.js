/**
 * Unified Modal System for ClearTrack
 * 
 * Provides consistent modal functionality across the entire application
 * All modals use the same structure and behavior
 */

// Standardized Modal System
window.ModalSystem = {
    /**
     * Show a modal by ID
     * @param {string} modalId - The ID of the modal to show
     */
    show: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && modal.classList.contains('modal-overlay')) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            
            // Focus management for accessibility
            const firstInput = modal.querySelector('input, textarea, select, button:not(.modal-close)');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    },

    /**
     * Hide a modal by ID
     * @param {string} modalId - The ID of the modal to hide
     */
    hide: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && modal.classList.contains('modal-overlay')) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    },

    /**
     * Toggle a modal's visibility
     * @param {string} modalId - The ID of the modal to toggle
     */
    toggle: function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && modal.classList.contains('modal-overlay')) {
            if (modal.classList.contains('hidden')) {
                this.show(modalId);
            } else {
                this.hide(modalId);
            }
        }
    },

    /**
     * Hide all open modals
     */
    hideAll: function() {
        const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        openModals.forEach(modal => {
            modal.classList.add('hidden');
        });
        document.body.style.overflow = '';
    }
};

// Initialize modal system - works immediately or on DOMContentLoaded
function initModalSystem() {
    // Close modal on overlay click
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            const modalId = e.target.id;
            if (modalId) {
                window.ModalSystem.hide(modalId);
            }
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal-overlay:not(.hidden)');
            if (openModal && openModal.id) {
                window.ModalSystem.hide(openModal.id);
            }
        }
    });

    // Prevent modal content clicks from closing modal
    document.addEventListener('click', function(e) {
        if (e.target.closest('.modal') && !e.target.closest('.modal-close')) {
            e.stopPropagation();
        }
    });
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModalSystem);
} else {
    initModalSystem();
}

// Global helper functions for backward compatibility
window.showModal = function(modalId) {
    window.ModalSystem.show(modalId);
};

window.hideModal = function(modalId) {
    window.ModalSystem.hide(modalId);
};

window.closeModal = function(modalId) {
    window.ModalSystem.hide(modalId);
};

window.closeAllModals = function() {
    window.ModalSystem.hideAll();
};

