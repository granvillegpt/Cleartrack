/**
 * Logbook Generator
 * 
 * Generates SARS-compliant logbook entries from expanded visits and distance data.
 * Creates sequential trip entries: Home → Visit1, Visit1 → Visit2, Visit2 → Visit3, Visit3 → Home.
 * Each movement becomes a separate logbook entry with sequential odometer progression.
 * 
 * @module logbook-generator
 */

/**
 * Generates SARS-compliant logbook from visits and distances
 * Creates separate trip entries for each movement between locations.
 * 
 * @param {Array} visits - Array of visit objects from expandRoutes
 * @param {Map|Object} distanceMap - Map or object mapping trip keys to distance in km
 *   Keys format: "HOME→{address}" or "{address1}→{address2}" or "{address}→HOME"
 * @param {number} vehicleOpeningKm - Starting odometer reading
 * @param {string} homeAddress - Home/base address for "from" field
 * @returns {Array} Array of SARS-compliant logbook entries
 * @throws {Error} If required data is missing or invalid
 * 
 * @example
 * const logbook = generateLogbook(visits, distances, 50000, '123 Home Street');
 * // Returns: [
 * //   { date: '2024-03-04', openingKm: 50000, closingKm: 50015, businessKm: 15, privateKm: 0, purpose: 'Client visit – ABC Corp', from: '123 Home Street', to: '456 Client Ave, Cape Town' },
 * //   { date: '2024-03-04', openingKm: 50015, closingKm: 50028, businessKm: 13, privateKm: 0, purpose: 'Client visit – XYZ Ltd', from: '456 Client Ave, Cape Town', to: '789 Business Rd, Cape Town' },
 * //   ...
 * // ]
 */
function generateLogbook(visits, distanceMap, vehicleOpeningKm, homeAddress) {
    if (!Array.isArray(visits) || visits.length === 0) {
        throw new Error('Visits array is required and must not be empty');
    }

    if (!distanceMap) {
        throw new Error('Distance map is required');
    }

    if (typeof vehicleOpeningKm !== 'number' || vehicleOpeningKm < 0 || isNaN(vehicleOpeningKm)) {
        throw new Error(`Invalid vehicle opening KM: ${vehicleOpeningKm}. Must be a non-negative number.`);
    }

    if (!homeAddress || typeof homeAddress !== 'string') {
        throw new Error('Home address is required and must be a string');
    }

    // Convert distanceMap to Map if it's an object
    const distances = distanceMap instanceof Map 
        ? distanceMap 
        : new Map(Object.entries(distanceMap));

    // Sort visits by date, then by rowIndex to maintain template order
    const sortedVisits = [...visits].sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        // Same date: sort by rowIndex to maintain template order
        const aIndex = a.rowIndex || 999999;
        const bIndex = b.rowIndex || 999999;
        return aIndex - bIndex;
    });

    // Group visits by date
    const visitsByDate = new Map();
    for (const visit of sortedVisits) {
        if (!visitsByDate.has(visit.date)) {
            visitsByDate.set(visit.date, []);
        }
        visitsByDate.get(visit.date).push(visit);
    }

    // Generate logbook entries - one per trip movement
    const logbook = [];
    let currentKm = vehicleOpeningKm;

    for (const [date, dayVisits] of visitsByDate.entries()) {
        // Sort day visits by rowIndex to ensure correct sequence
        dayVisits.sort((a, b) => {
            const aIndex = a.rowIndex || 999999;
            const bIndex = b.rowIndex || 999999;
            return aIndex - bIndex;
        });

        if (dayVisits.length === 0) {
            continue; // Skip days with no visits
        }

        // Trip 1: Home → First Visit
        const firstVisit = dayVisits[0];
        const firstVisitAddress = firstVisit.suburb 
            ? `${firstVisit.address}, ${firstVisit.suburb}`
            : firstVisit.address;
        
        const homeToFirstKey = `HOME→${firstVisit.address}`;
        const homeToFirstDistance = distances.get(homeToFirstKey);
        
        if (homeToFirstDistance === undefined || homeToFirstDistance === null) {
            throw new Error(`Missing distance for trip: ${homeToFirstKey}`);
        }

        if (typeof homeToFirstDistance !== 'number' || homeToFirstDistance < 0 || isNaN(homeToFirstDistance)) {
            throw new Error(`Invalid distance for trip "${homeToFirstKey}": ${homeToFirstDistance}`);
        }

        // Create first trip entry: Home → First Visit
        const firstTripOpeningKm = currentKm;
        const firstTripClosingKm = firstTripOpeningKm + homeToFirstDistance;
        
        logbook.push({
            date,
            openingKm: firstTripOpeningKm,
            closingKm: firstTripClosingKm,
            businessKm: homeToFirstDistance,
            privateKm: 0,
            purpose: `${firstVisit.reason || 'Sales Visit'} – ${firstVisit.customer}`,
            from: homeAddress,
            to: firstVisitAddress
        });

        currentKm = firstTripClosingKm;

        // Trips 2 to N: Visit(i) → Visit(i+1)
        for (let i = 0; i < dayVisits.length - 1; i++) {
            const fromVisit = dayVisits[i];
            const toVisit = dayVisits[i + 1];
            
            const fromAddress = fromVisit.suburb 
                ? `${fromVisit.address}, ${fromVisit.suburb}`
                : fromVisit.address;
            const toAddress = toVisit.suburb 
                ? `${toVisit.address}, ${toVisit.suburb}`
                : toVisit.address;
            
            const tripKey = `${fromVisit.address}→${toVisit.address}`;
            const tripDistance = distances.get(tripKey);
            
            if (tripDistance === undefined || tripDistance === null) {
                throw new Error(`Missing distance for trip: ${tripKey}`);
            }

            if (typeof tripDistance !== 'number' || tripDistance < 0 || isNaN(tripDistance)) {
                throw new Error(`Invalid distance for trip "${tripKey}": ${tripDistance}`);
            }

            // Create sequential trip entry
            const tripOpeningKm = currentKm;
            const tripClosingKm = tripOpeningKm + tripDistance;
            
            logbook.push({
                date,
                openingKm: tripOpeningKm,
                closingKm: tripClosingKm,
                businessKm: tripDistance,
                privateKm: 0,
                purpose: `${toVisit.reason || 'Sales Visit'} – ${toVisit.customer}`,
                from: fromAddress,
                to: toAddress
            });

            currentKm = tripClosingKm;
        }

        // Final trip: Last Visit → Home
        const lastVisit = dayVisits[dayVisits.length - 1];
        const lastVisitAddress = lastVisit.suburb 
            ? `${lastVisit.address}, ${lastVisit.suburb}`
            : lastVisit.address;
        
        const lastToHomeKey = `${lastVisit.address}→HOME`;
        const lastToHomeDistance = distances.get(lastToHomeKey);
        
        if (lastToHomeDistance === undefined || lastToHomeDistance === null) {
            throw new Error(`Missing distance for return trip: ${lastToHomeKey}`);
        }

        if (typeof lastToHomeDistance !== 'number' || lastToHomeDistance < 0 || isNaN(lastToHomeDistance)) {
            throw new Error(`Invalid distance for return trip "${lastToHomeKey}": ${lastToHomeDistance}`);
        }

        // Create return trip entry
        const returnTripOpeningKm = currentKm;
        const returnTripClosingKm = returnTripOpeningKm + lastToHomeDistance;
        
        logbook.push({
            date,
            openingKm: returnTripOpeningKm,
            closingKm: returnTripClosingKm,
            businessKm: lastToHomeDistance,
            privateKm: 0,
            purpose: `Return to Base`,
            from: lastVisitAddress,
            to: homeAddress
        });

        currentKm = returnTripClosingKm;
    }

    return logbook;
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateLogbook };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.generateLogbook = generateLogbook;
}

