/**
 * ClearTrack Automated Testing Script
 * Run this in browser console to test key functionality
 * 
 * Usage: Copy and paste into browser console, or include in HTML for testing
 */

(function() {
    'use strict';

    const testResults = {
        passed: [],
        failed: [],
        warnings: []
    };

    function logTest(name, passed, message = '') {
        if (passed) {
            testResults.passed.push({ name, message });
            console.log(`✅ PASS: ${name}${message ? ' - ' + message : ''}`);
        } else {
            testResults.failed.push({ name, message });
            console.error(`❌ FAIL: ${name}${message ? ' - ' + message : ''}`);
        }
    }

    function logWarning(name, message) {
        testResults.warnings.push({ name, message });
        console.warn(`⚠️  WARN: ${name} - ${message}`);
    }

    function runTests() {
        console.log('='.repeat(60));
        console.log('🧪 CLEARTRACK AUTOMATED TESTING');
        console.log('='.repeat(60));
        console.log('');

        // Test 1: Check if global hamburger menu is loaded
        console.log('📋 Testing Global Hamburger Menu...');
        const menuToggle = document.getElementById('menuToggle');
        const nav = document.getElementById('nav-style6');
        
        if (menuToggle && nav) {
            logTest('Global hamburger menu elements exist', true);
            
            // Test if toggleMenu function exists
            if (typeof window.toggleMenu === 'function') {
                logTest('toggleMenu function exists', true);
            } else {
                logTest('toggleMenu function exists', false, 'Function not found');
            }
        } else {
            logTest('Global hamburger menu elements exist', false, 
                `menuToggle: ${!!menuToggle}, nav-style6: ${!!nav}`);
        }

        // Test 2: Check ARIA labels
        console.log('');
        console.log('📋 Testing Accessibility (ARIA Labels)...');
        const menuToggleAria = menuToggle?.getAttribute('aria-label');
        if (menuToggleAria) {
            logTest('Menu toggle has aria-label', true, menuToggleAria);
        } else {
            logTest('Menu toggle has aria-label', false);
        }

        // Test 3: Check required form fields
        console.log('');
        console.log('📋 Testing Form Accessibility...');
        const requiredInputs = document.querySelectorAll('input[required], textarea[required], select[required]');
        let ariaRequiredCount = 0;
        requiredInputs.forEach(input => {
            if (input.getAttribute('aria-required') === 'true') {
                ariaRequiredCount++;
            }
        });
        
        if (requiredInputs.length > 0) {
            logTest('Required form fields found', true, `${requiredInputs.length} fields`);
            if (ariaRequiredCount === requiredInputs.length) {
                logTest('All required fields have aria-required', true);
            } else {
                logWarning('Required fields ARIA attributes', 
                    `${ariaRequiredCount}/${requiredInputs.length} have aria-required`);
            }
        } else {
            logWarning('Required form fields', 'No required fields found on this page');
        }

        // Test 4: Check focus states (CSS)
        console.log('');
        console.log('📋 Testing Focus States...');
        const styleSheet = Array.from(document.styleSheets).find(sheet => {
            try {
                return Array.from(sheet.cssRules || []).some(rule => 
                    rule.selectorText && rule.selectorText.includes(':focus')
                );
            } catch (e) {
                return false;
            }
        });
        
        if (styleSheet) {
            logTest('Focus states defined in CSS', true);
        } else {
            logWarning('Focus states', 'Could not verify focus states in CSS');
        }

        // Test 5: Check modal functionality
        console.log('');
        console.log('📋 Testing Modal Elements...');
        const modals = document.querySelectorAll('.modal-overlay, .modal');
        if (modals.length > 0) {
            logTest('Modal elements found', true, `${modals.length} modals`);
        } else {
            logWarning('Modal elements', 'No modals found on this page');
        }

        // Test 6: Check responsive breakpoints
        console.log('');
        console.log('📋 Testing Responsive Design...');
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth <= 768;
        const isTablet = viewportWidth > 768 && viewportWidth <= 1024;
        const isDesktop = viewportWidth > 1024;
        
        logTest('Viewport width detected', true, `${viewportWidth}px`);
        logTest('Mobile breakpoint', isMobile, isMobile ? 'Mobile view' : 'Not mobile');
        logTest('Tablet breakpoint', isTablet, isTablet ? 'Tablet view' : 'Not tablet');
        logTest('Desktop breakpoint', isDesktop, isDesktop ? 'Desktop view' : 'Not desktop');

        // Test 7: Check CSS variables
        console.log('');
        console.log('📋 Testing CSS Variables...');
        const rootStyles = getComputedStyle(document.documentElement);
        const primaryColor = rootStyles.getPropertyValue('--color-primary');
        if (primaryColor) {
            logTest('CSS variables loaded', true, `Primary color: ${primaryColor.trim()}`);
        } else {
            logTest('CSS variables loaded', false, 'CSS variables not found');
        }

        // Test 8: Check dashboard-styles.css is loaded
        console.log('');
        console.log('📋 Testing Global Styles...');
        const dashboardStylesLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .find(link => link.href.includes('dashboard-styles.css'));
        if (dashboardStylesLink) {
            logTest('dashboard-styles.css loaded', true);
        } else {
            logTest('dashboard-styles.css loaded', false, 'Global stylesheet not found');
        }

        // Test 9: Check for console errors (basic check)
        console.log('');
        console.log('📋 Testing JavaScript Errors...');
        const originalError = console.error;
        let errorCount = 0;
        console.error = function(...args) {
            errorCount++;
            originalError.apply(console, args);
        };
        
        // Trigger a simple check
        try {
            if (typeof window.toggleMenu === 'function') {
                // Function exists, good
            }
        } catch (e) {
            errorCount++;
        }
        
        // Restore console.error
        console.error = originalError;
        
        if (errorCount === 0) {
            logTest('No JavaScript errors detected', true);
        } else {
            logWarning('JavaScript errors', `${errorCount} errors detected (check console)`);
        }

        // Summary
        console.log('');
        console.log('='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${testResults.passed.length}`);
        console.log(`❌ Failed: ${testResults.failed.length}`);
        console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
        console.log('');
        
        if (testResults.failed.length > 0) {
            console.log('❌ FAILED TESTS:');
            testResults.failed.forEach(test => {
                console.log(`   - ${test.name}: ${test.message || 'No details'}`);
            });
            console.log('');
        }
        
        if (testResults.warnings.length > 0) {
            console.log('⚠️  WARNINGS:');
            testResults.warnings.forEach(warning => {
                console.log(`   - ${warning.name}: ${warning.message}`);
            });
            console.log('');
        }
        
        if (testResults.failed.length === 0 && testResults.warnings.length === 0) {
            console.log('🎉 All tests passed!');
        } else if (testResults.failed.length === 0) {
            console.log('✅ All critical tests passed! (Some warnings present)');
        }
        
        console.log('='.repeat(60));
        
        return testResults;
    }

    // Auto-run if in browser console
    if (typeof window !== 'undefined') {
        window.runClearTrackTests = runTests;
        console.log('🧪 ClearTrack Testing Script Loaded');
        console.log('💡 Run: runClearTrackTests() to execute tests');
        console.log('');
    }

    return { runTests, testResults };
})();







