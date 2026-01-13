/**
 * Route Expander
 * 
 * Expands recurring routes into actual calendar dates based on weekday patterns
 * and a deterministic 4-week rolling cycle.
 * 
 * @module route-expander
 */

/**
 * Gets weekday number (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param {Date} date - Date to check
 * @returns {number} Weekday number
 */
function getWeekday(date) {
    return date.getDay();
}

/**
 * Calculates the current week cycle (1-4) based on a rolling 4-week cycle
 * @param {Date} startDate - Start date of the tax year
 * @param {Date} currentDate - Current date to check
 * @param {number} initialWeek - Starting week (1-4)
 * @returns {number} Current week cycle (1-4)
 */
function getCurrentWeekCycle(startDate, currentDate, initialWeek) {
    // Calculate days elapsed since start
    const daysElapsed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
    
    // Calculate which 7-day period we're in (0-indexed)
    const weekPeriod = Math.floor(daysElapsed / 7);
    
    // Calculate current week in the 4-week cycle
    // Start with initialWeek, then cycle: (initialWeek - 1 + weekPeriod) % 4 + 1
    const weekCycle = ((initialWeek - 1 + weekPeriod) % 4) + 1;
    
    return weekCycle;
}

/**
 * Converts weekday number to day key
 * @param {number} weekday - Weekday number (0=Sunday, 1=Monday, etc.)
 * @returns {string|null} Day key ('mon', 'tue', etc.) or null for Sunday
 */
function weekdayToDayKey(weekday) {
    const mapping = {
        1: 'mon',
        2: 'tue',
        3: 'wed',
        4: 'thu',
        5: 'fri',
        6: 'sat'
    };
    return mapping[weekday] || null;
}


/**
 * Formats date as ISO string (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @returns {string} ISO date string
 */
function formatISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Checks if a date is in the leave days array
 * @param {Date} date - Date to check
 * @param {string[]} leaveDays - Array of ISO date strings
 * @returns {boolean}
 */
function isLeaveDay(date, leaveDays) {
    if (!leaveDays || leaveDays.length === 0) {
        return false;
    }
    const dateStr = formatISODate(date);
    return leaveDays.includes(dateStr);
}

/**
 * Expands routes into actual calendar visit dates using a deterministic 4-week rolling cycle
 * 
 * @param {Array} routes - Array of route objects from parseRouteTemplate
 * @param {Object} options - Configuration options
 * @param {Object} options.taxYear - Tax year date range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 * @param {number} options.currentWeek - Starting week cycle (1, 2, 3, or 4)
 * @param {string[]} [options.leaveDays] - Array of ISO date strings to exclude (e.g. ['2024-12-25', '2024-12-26'])
 * @returns {Array} Array of visit objects with date, customer, address, suburb
 * @throws {Error} If options are invalid or no visits are generated
 * 
 * @example
 * const visits = expandRoutes(routes, {
 *   taxYear: { start: '2024-03-01', end: '2025-02-28' },
 *   currentWeek: 1,
 *   leaveDays: ['2024-12-25']
 * });
 * // Returns: [{ date: '2024-03-04', customer: 'ABC Corp', address: '123 Main St', suburb: 'Cape Town' }, ...]
 */
function expandRoutes(routes, options) {
    if (!routes || routes.length === 0) {
        throw new Error('No routes provided');
    }

    if (!options || typeof options !== 'object') {
        throw new Error('Options object is required');
    }

    if (!options.taxYear || !options.taxYear.start || !options.taxYear.end) {
        throw new Error('options.taxYear with start and end dates is required');
    }

    if (options.currentWeek === undefined || options.currentWeek === null) {
        throw new Error('options.currentWeek is required and must be 1, 2, 3, or 4');
    }

    const currentWeek = Number(options.currentWeek);
    if (!Number.isInteger(currentWeek) || currentWeek < 1 || currentWeek > 4) {
        throw new Error(`options.currentWeek must be 1, 2, 3, or 4. Received: ${options.currentWeek}`);
    }

    const leaveDays = options.leaveDays || [];

    // Define business purposes for random selection per visit
    const businessPurposes = [
        'Sales Visit',
        'Customer Meeting',
        'Product Promotion',
        'Order Follow-up',
        'Training / Demo'
    ];

    // Parse tax year dates
    const start = new Date(options.taxYear.start);
    const end = new Date(options.taxYear.end);

    if (isNaN(start.getTime())) {
        throw new Error(`Invalid tax year start date: ${options.taxYear.start}`);
    }
    if (isNaN(end.getTime())) {
        throw new Error(`Invalid tax year end date: ${options.taxYear.end}`);
    }

    if (start > end) {
        throw new Error('Tax year start date must be before end date');
    }

    const visits = [];

    // Iterate through each day in the tax year
    const currentDate = new Date(start);
    while (currentDate <= end) {
        // Calculate current week cycle (1-4) based on rolling 4-week cycle
        const weekCycle = getCurrentWeekCycle(start, currentDate, currentWeek);
        
        const weekday = getWeekday(currentDate);
        const dayKey = weekdayToDayKey(weekday);
        const dateStr = formatISODate(currentDate);

        // Skip if it's a leave day
        if (isLeaveDay(currentDate, leaveDays)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
        }

        // Check each route to see if it matches this date
        for (const route of routes) {
            // Check if this weekday is enabled for this route
            if (!dayKey || !route.days[dayKey]) {
                continue;
            }

            // Check if this week cycle is included in route.weeks
            // route.weeks should only contain 1, 2, 3, or 4 (no week 5)
            if (!route.weeks.includes(weekCycle)) {
                continue;
            }

            // This route matches this date - add visit
            // Randomly select a reason for this specific visit
            const randomReason = businessPurposes[Math.floor(Math.random() * businessPurposes.length)];
            
            visits.push({
                date: dateStr,
                customer: route.customer,
                address: route.address,
                suburb: route.suburb,
                rowIndex: route.rowIndex || 999999,  // Preserve template order (high number as fallback)
                reason: randomReason  // Each visit gets its own random reason
            });
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort visits by date
    visits.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
    });

    // Remove duplicates (same date + customer)
    const uniqueVisits = [];
    const seen = new Set();
    for (const visit of visits) {
        const key = `${visit.date}_${visit.customer}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueVisits.push(visit);
        }
    }

    if (uniqueVisits.length === 0) {
        throw new Error('No visits generated for provided routes and date range. Check that routes have enabled days and weeks that match the current week cycle.');
    }

    return uniqueVisits;
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { expandRoutes, formatISODate };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.expandRoutes = expandRoutes;
    window.formatISODate = formatISODate;
}

window.expandRoutes = expandRoutes;

