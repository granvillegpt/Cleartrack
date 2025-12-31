/**
 * Logbook Pipeline Orchestrator
 * 
 * Single entry point for executing the complete ClearTrack logbook generation pipeline.
 * Orchestrates parsing, route expansion, distance calculation, and logbook generation.
 * 
 * @module logbook-pipeline
 */

// Import core modules
import { parseRouteTemplate } from './route-template-parser.js';
import { expandRoutes } from './route-expander.js';
import { GoogleDistanceService } from './google-distance-service.js';
import { generateLogbook } from './logbook-generator.js';

/**
 * Validates pipeline options and throws descriptive errors if invalid
 * @param {Object} options - Pipeline options
 * @throws {Error} If any required option is missing or invalid
 */
function validateOptions(options) {
    if (!options || typeof options !== 'object') {
        throw new Error('Logbook pipeline failed: Options object is required');
    }

    if (!options.excelFile) {
        throw new Error('Logbook pipeline failed: excelFile is required');
    }

    if (!options.homeAddress || typeof options.homeAddress !== 'string' || options.homeAddress.trim() === '') {
        throw new Error('Logbook pipeline failed: homeAddress is required and must be a non-empty string');
    }

    if (options.openingKm === undefined || options.openingKm === null) {
        throw new Error('Logbook pipeline failed: openingKm is required');
    }

    if (typeof options.openingKm !== 'number' || isNaN(options.openingKm) || options.openingKm <= 0) {
        throw new Error(`Logbook pipeline failed: openingKm must be a positive number. Received: ${options.openingKm}`);
    }

    if (!options.taxYear || typeof options.taxYear !== 'object') {
        throw new Error('Logbook pipeline failed: taxYear is required and must be an object');
    }

    if (!options.taxYear.start || typeof options.taxYear.start !== 'string') {
        throw new Error('Logbook pipeline failed: taxYear.start is required and must be a string (YYYY-MM-DD)');
    }

    if (!options.taxYear.end || typeof options.taxYear.end !== 'string') {
        throw new Error('Logbook pipeline failed: taxYear.end is required and must be a string (YYYY-MM-DD)');
    }

    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(options.taxYear.start)) {
        throw new Error(`Logbook pipeline failed: taxYear.start must be in YYYY-MM-DD format. Received: ${options.taxYear.start}`);
    }

    if (!dateRegex.test(options.taxYear.end)) {
        throw new Error(`Logbook pipeline failed: taxYear.end must be in YYYY-MM-DD format. Received: ${options.taxYear.end}`);
    }

    if (options.currentWeek === undefined || options.currentWeek === null) {
        throw new Error('Logbook pipeline failed: currentWeek is required');
    }

    const currentWeek = Number(options.currentWeek);
    if (!Number.isInteger(currentWeek) || currentWeek < 1 || currentWeek > 4) {
        throw new Error(`Logbook pipeline failed: currentWeek must be 1, 2, 3, or 4. Received: ${options.currentWeek}`);
    }

    if (!options.googleApiKey || typeof options.googleApiKey !== 'string' || options.googleApiKey.trim() === '') {
        throw new Error('Logbook pipeline failed: googleApiKey is required and must be a non-empty string');
    }

    // Validate leaveDays if provided
    if (options.leaveDays !== undefined) {
        if (!Array.isArray(options.leaveDays)) {
            throw new Error('Logbook pipeline failed: leaveDays must be an array of ISO date strings');
        }

        for (const leaveDay of options.leaveDays) {
            if (typeof leaveDay !== 'string' || !dateRegex.test(leaveDay)) {
                throw new Error(`Logbook pipeline failed: leaveDays must contain ISO date strings (YYYY-MM-DD). Invalid entry: ${leaveDay}`);
            }
        }
    }
}

/**
 * Executes the complete logbook generation pipeline
 * 
 * Pipeline execution order:
 * 1. Parse Excel template into route objects
 * 2. Expand routes into dated visits using 4-week rolling cycle
 * 3. Calculate distances from home to all client addresses
 * 4. Generate SARS-compliant logbook entries
 * 
 * @param {Object} options - Pipeline configuration options
 * @param {File|ArrayBuffer|string} options.excelFile - Excel file (File object, ArrayBuffer, or data URL)
 * @param {string} options.homeAddress - Home/base address for distance calculations
 * @param {number} options.openingKm - Starting odometer reading (must be > 0)
 * @param {Object} options.taxYear - Tax year date range
 * @param {string} options.taxYear.start - Start date in YYYY-MM-DD format
 * @param {string} options.taxYear.end - End date in YYYY-MM-DD format
 * @param {number} options.currentWeek - Current week cycle (1, 2, 3, or 4)
 * @param {string[]} [options.leaveDays] - Optional array of ISO date strings to exclude
 * @param {string} options.googleApiKey - Google Maps API key for distance calculations
 * @returns {Promise<Object>} Pipeline result with logbook and metadata
 * @returns {Array} returns.logbook - SARS-compliant logbook entries
 * @returns {Object} returns.meta - Generation metadata
 * @returns {string} returns.meta.generatedAt - ISO timestamp of generation
 * @returns {Object} returns.meta.taxYear - Tax year date range
 * @returns {number} returns.meta.currentWeek - Week cycle used
 * @returns {number} returns.meta.totalEntries - Number of logbook entries generated
 * @throws {Error} If validation fails or any pipeline step fails
 * 
 * @example
 * const result = await runLogbookPipeline({
 *   excelFile: fileInput,
 *   homeAddress: '123 Home Street, Cape Town',
 *   openingKm: 50000,
 *   taxYear: { start: '2024-03-01', end: '2025-02-28' },
 *   currentWeek: 1,
 *   leaveDays: ['2024-12-25', '2024-12-26'],
 *   googleApiKey: 'YOUR_API_KEY'
 * });
 * // Returns: { logbook: [...], meta: { generatedAt: '...', taxYear: {...}, currentWeek: 1, totalEntries: 150 } }
 */
export async function runLogbookPipeline(options) {
    // Validate all options
    validateOptions(options);

    try {
        // Step 1: Parse Excel template
        const routes = await parseRouteTemplate(options.excelFile);

        // Step 2: Expand routes into dated visits
        const visits = expandRoutes(routes, {
            taxYear: options.taxYear,
            currentWeek: options.currentWeek,
            leaveDays: options.leaveDays || []
        });

        // Step 3: Calculate distances
        const distanceService = new GoogleDistanceService(options.googleApiKey);
        const distances = await distanceService.getDistances(
            options.homeAddress,
            visits.map(v => v.address)
        );

        // Step 4: Generate SARS-compliant logbook
        const logbook = generateLogbook(
            visits,
            distances,
            options.openingKm,
            options.homeAddress
        );

        // Return result with metadata
        return {
            logbook,
            meta: {
                generatedAt: new Date().toISOString(),
                taxYear: options.taxYear,
                currentWeek: options.currentWeek,
                totalEntries: logbook.length
            }
        };
    } catch (error) {
        // Wrap any errors with pipeline context
        if (error.message && error.message.startsWith('Logbook pipeline failed:')) {
            throw error;
        }
        throw new Error(`Logbook pipeline failed: ${error.message || error.toString()}`);
    }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { runLogbookPipeline };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.runLogbookPipeline = runLogbookPipeline;
}

