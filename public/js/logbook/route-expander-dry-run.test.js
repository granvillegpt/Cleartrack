/**
 * Route Expander Dry-Run Test Harness
 * 
 * Validates expandRoutes() by testing route expansion with deterministic inputs.
 * Tests 4-week rolling cycle, leave day exclusion, and tax year boundaries.
 * 
 * This is a temporary test file for verification purposes.
 */

/**
 * Groups visits by month for display
 * @param {Array} visits - Array of visit objects
 * @returns {Object} Visits grouped by month (YYYY-MM format)
 */
function groupVisitsByMonth(visits) {
    const grouped = {};
    for (const visit of visits) {
        const monthKey = visit.date.substring(0, 7); // Extract YYYY-MM
        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(visit);
    }
    return grouped;
}

/**
 * Runs the route expander dry-run test
 */
async function runRouteExpanderDryRun() {
    console.log('='.repeat(80));
    console.log('ROUTE EXPANDER DRY RUN');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Ensure expandRoutes is available
        if (typeof expandRoutes === 'undefined') {
            throw new Error('expandRoutes function is not available. Ensure route-expander.js is loaded.');
        }

        // Define test routes (matching real parser output format)
        const routes = [
            {
                customer: "Checkers Hyper Brackenfell",
                address: "Fairbridge Mall, Brackenfell",
                suburb: "Brackenfell",
                days: { mon: true, tue: false, wed: false, thu: true, fri: false, sat: false },
                weeks: [1, 2, 3, 4]
            }
        ];

        // Define deterministic options
        const options = {
            taxYear: {
                start: "2024-03-01",
                end: "2025-02-28"
            },
            currentWeek: 2,
            leaveDays: ["2024-04-01", "2024-12-25"]
        };

        console.log('Test Configuration:');
        console.log('- Routes:', JSON.stringify(routes, null, 2));
        console.log('- Tax Year:', options.taxYear.start, 'to', options.taxYear.end);
        console.log('- Current Week:', options.currentWeek);
        console.log('- Leave Days:', options.leaveDays);
        console.log('');

        // Execute expandRoutes
        console.log('Executing expandRoutes()...');
        const visits = expandRoutes(routes, options);
        console.log('✅ Expansion complete');
        console.log('');

        // Log results
        console.log('='.repeat(80));
        console.log('RESULTS');
        console.log('='.repeat(80));
        console.log(`Total visit count: ${visits.length}`);
        console.log('');

        // Log first 10 visits
        console.log('='.repeat(80));
        console.log('FIRST 10 VISITS');
        console.log('='.repeat(80));
        const first10 = visits.slice(0, 10);
        console.log(JSON.stringify(first10, null, 2));
        console.log('');

        // Group visits by month and display in table
        console.log('='.repeat(80));
        console.log('ALL VISITS GROUPED BY MONTH');
        console.log('='.repeat(80));
        const groupedByMonth = groupVisitsByMonth(visits);
        
        // Create table data
        const tableData = [];
        for (const [month, monthVisits] of Object.entries(groupedByMonth)) {
            for (const visit of monthVisits) {
                tableData.push({
                    'Month': month,
                    'Date': visit.date,
                    'Customer': visit.customer,
                    'Address': visit.address,
                    'Suburb': visit.suburb
                });
            }
        }
        
        console.table(tableData);
        console.log('');

        // Validation checks
        console.log('='.repeat(80));
        console.log('VALIDATION CHECKS');
        console.log('='.repeat(80));
        
        // Check for duplicates
        const dateSet = new Set();
        let duplicates = 0;
        for (const visit of visits) {
            const key = `${visit.date}_${visit.customer}`;
            if (dateSet.has(key)) {
                duplicates++;
            }
            dateSet.add(key);
        }
        console.log(`Duplicate visits: ${duplicates} (expected: 0)`);
        
        // Check sorting
        let isSorted = true;
        for (let i = 1; i < visits.length; i++) {
            if (visits[i].date < visits[i - 1].date) {
                isSorted = false;
                break;
            }
        }
        console.log(`Sorted ascending: ${isSorted ? '✅' : '❌'}`);
        
        // Check leave day exclusion
        const leaveDaysSet = new Set(options.leaveDays);
        let leaveDayVisits = 0;
        for (const visit of visits) {
            if (leaveDaysSet.has(visit.date)) {
                leaveDayVisits++;
            }
        }
        console.log(`Visits on leave days: ${leaveDayVisits} (expected: 0)`);
        
        // Check date range
        const firstDate = visits[0]?.date;
        const lastDate = visits[visits.length - 1]?.date;
        console.log(`Date range: ${firstDate} to ${lastDate}`);
        console.log(`Within tax year: ${firstDate >= options.taxYear.start && lastDate <= options.taxYear.end ? '✅' : '❌'}`);
        console.log('');

        console.log('='.repeat(80));
        console.log('✅ ROUTE EXPANDER DRY-RUN COMPLETE');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('='.repeat(80));
        console.error('❌ ROUTE EXPANDER DRY-RUN FAILED');
        console.error('='.repeat(80));
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(80));
        throw error;
    }
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready and ensure expandRoutes is loaded
    const waitForExpandRoutes = () => {
        if (typeof expandRoutes !== 'undefined') {
            runRouteExpanderDryRun();
        } else {
            // Retry after a short delay
            setTimeout(waitForExpandRoutes, 100);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForExpandRoutes);
    } else {
        waitForExpandRoutes();
    }
}

// Export for manual invocation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runRouteExpanderDryRun };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.runRouteExpanderDryRun = runRouteExpanderDryRun;
}

