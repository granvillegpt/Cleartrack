/**
 * Logbook Generator
 * 
 * Generates SARS-compliant logbook entries from expanded visits and distance data.
 * Handles rolling opening/closing kilometers and combines multiple visits per day.
 * 
 * @module logbook-generator
 */

/**
 * Generates SARS-compliant logbook from visits and distances
 * 
 * @param {Array} visits - Array of visit objects from expandRoutes
 * @param {Map|Object} distanceMap - Map or object mapping address to distance in km
 * @param {number} vehicleOpeningKm - Starting odometer reading
 * @param {string} homeAddress - Home/base address for "from" field
 * @returns {Array} Array of SARS-compliant logbook entries
 * @throws {Error} If required data is missing or invalid
 * 
 * @example
 * const logbook = generateLogbook(visits, distances, 50000, '123 Home Street');
 * // Returns: [{ date: '2024-03-04', openingKm: 50000, closingKm: 50015, businessKm: 15, privateKm: 0, purpose: 'Client visit – ABC Corp', from: '123 Home Street', to: '456 Client Ave, Cape Town' }, ...]
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

    // Sort visits by date
    const sortedVisits = [...visits].sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return 0;
    });

    // Group visits by date
    const visitsByDate = new Map();
    for (const visit of sortedVisits) {
        if (!visitsByDate.has(visit.date)) {
            visitsByDate.set(visit.date, []);
        }
        visitsByDate.get(visit.date).push(visit);
    }

    // Generate logbook entries
    const logbook = [];
    let currentKm = vehicleOpeningKm;

    for (const [date, dayVisits] of visitsByDate.entries()) {
        const openingKm = currentKm;
        let totalBusinessKm = 0;
        const customers = [];
        const destinations = [];

        // Process all visits for this day
        for (const visit of dayVisits) {
            // Get distance for this visit
            const addressKey = visit.address;
            const distance = distances.get(addressKey);

            if (distance === undefined || distance === null) {
                throw new Error(`Missing distance for address: ${addressKey}`);
            }

            if (typeof distance !== 'number' || distance < 0 || isNaN(distance)) {
                throw new Error(`Invalid distance for address "${addressKey}": ${distance}`);
            }

            totalBusinessKm += distance;
            
            // Track unique customers and destinations
            if (!customers.includes(visit.customer)) {
                customers.push(visit.customer);
            }
            
            const destination = visit.suburb 
                ? `${visit.address}, ${visit.suburb}`
                : visit.address;
            
            if (!destinations.includes(destination)) {
                destinations.push(destination);
            }
        }

        // Calculate closing KM
        const closingKm = openingKm + totalBusinessKm;

        // Generate purpose string
        let purpose;
        if (customers.length === 1) {
            purpose = `Client visit – ${customers[0]}`;
        } else {
            purpose = `Client visit – ${customers.join(', ')}`;
        }

        // Generate "to" field - combine all destinations
        const to = destinations.join('; ');

        // Create logbook entry
        logbook.push({
            date,
            openingKm,
            closingKm,
            businessKm: totalBusinessKm,
            privateKm: 0, // Always 0 as per requirements
            purpose,
            from: homeAddress,
            to
        });

        // Update current KM for next day
        currentKm = closingKm;
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

