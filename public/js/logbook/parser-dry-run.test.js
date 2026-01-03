/**
 * Parser Dry-Run Test Harness
 * 
 * Validates route-template-parser.js by loading the real Excel template
 * and logging parsed output for visual verification.
 * 
 * This is a temporary test file for verification purposes.
 */

/**
 * Loads SheetJS library if not already available
 * @returns {Promise<void>}
 */
async function ensureSheetJS() {
    if (typeof XLSX !== 'undefined') {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load SheetJS library'));
        document.head.appendChild(script);
    });
}

/**
 * Fetches the Excel template file and converts it to a format parseRouteTemplate can use
 * @returns {Promise<ArrayBuffer>}
 */
async function loadExcelTemplate() {
    const templatePath = '/assets/Templates/Cleartrack Route List Template.xlsx';
    
    try {
        const response = await fetch(templatePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch template: HTTP ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        return arrayBuffer;
    } catch (error) {
        throw new Error(`Error loading Excel template: ${error.message}`);
    }
}

/**
 * Runs the parser dry-run test
 */
async function runParserDryRun() {
    console.log('='.repeat(80));
    console.log('PARSER DRY-RUN TEST');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Step 1: Ensure SheetJS is loaded
        console.log('📦 Step 1: Loading SheetJS library...');
        await ensureSheetJS();
        console.log('✅ SheetJS loaded');
        console.log('');

        // Step 2: Load Excel template
        console.log('📄 Step 2: Loading Excel template...');
        const excelFile = await loadExcelTemplate();
        console.log(`✅ Template loaded (${excelFile.byteLength} bytes)`);
        console.log('');

        // Step 3: Parse template
        console.log('🔍 Step 3: Parsing route template...');
        const routes = await parseRouteTemplate(excelFile);
        console.log('✅ Parsing complete');
        console.log('');

        // Step 4: Log results
        console.log('='.repeat(80));
        console.log('PARSED ROUTES SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total routes found: ${routes.length}`);
        console.log('');

        if (routes.length === 0) {
            console.warn('⚠️  No routes were parsed from the template');
            return;
        }

        // Log first 3 routes verbatim
        console.log('='.repeat(80));
        console.log('FIRST 3 ROUTES (VERBATIM)');
        console.log('='.repeat(80));
        for (let i = 0; i < Math.min(3, routes.length); i++) {
            console.log(`\nRoute ${i + 1}:`);
            console.log(JSON.stringify(routes[i], null, 2));
        }
        console.log('');

        // Log all routes in table format
        console.log('='.repeat(80));
        console.log('ALL ROUTES (TABLE FORMAT)');
        console.log('='.repeat(80));
        
        // Prepare table data
        const tableData = routes.map((route, index) => ({
            '#': index + 1,
            'Customer': route.customer,
            'Address': route.address,
            'Suburb': route.suburb,
            'Mon': route.days.mon ? '✓' : '',
            'Tue': route.days.tue ? '✓' : '',
            'Wed': route.days.wed ? '✓' : '',
            'Thu': route.days.thu ? '✓' : '',
            'Fri': route.days.fri ? '✓' : '',
            'Sat': route.days.sat ? '✓' : '',
            'Weeks': route.weeks.join(',')
        }));

        console.table(tableData);
        console.log('');

        // Log full routes array
        console.log('='.repeat(80));
        console.log('FULL PARSED ROUTES ARRAY');
        console.log('='.repeat(80));
        console.log(JSON.stringify(routes, null, 2));
        console.log('');

        console.log('='.repeat(80));
        console.log('✅ PARSER DRY-RUN COMPLETE');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('='.repeat(80));
        console.error('❌ PARSER DRY-RUN FAILED');
        console.error('='.repeat(80));
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('='.repeat(80));
        throw error;
    }
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runParserDryRun);
    } else {
        // DOM already ready, run immediately
        runParserDryRun();
    }
}

// Export for manual invocation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runParserDryRun };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.runParserDryRun = runParserDryRun;
}

