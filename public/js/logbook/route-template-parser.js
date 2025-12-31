/**
 * Route Template Parser
 * 
 * Parses ClearTrack Route List Excel templates into structured route objects.
 * 
 * @module route-template-parser
 */

/**
 * Loads SheetJS library if not already available
 * @returns {Promise<void>}
 */
async function loadSheetJS() {
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
 * Finds column index by name (case-insensitive)
 * @param {Array} headerRow - Array of header cell values
 * @param {string} columnName - Column name to find
 * @returns {number|null} Column index or null if not found
 */
function findColumnIndex(headerRow, columnName) {
    const normalizedName = columnName.toLowerCase().trim();
    for (let i = 0; i < headerRow.length; i++) {
        if (headerRow[i] && headerRow[i].toString().toLowerCase().trim() === normalizedName) {
            return i;
        }
    }
    return null;
}

/**
 * Converts Excel cell value to boolean
 * Handles various checkbox representations: true, 1, "TRUE", "1", "x", "X", etc.
 * @param {*} value - Cell value
 * @returns {boolean}
 */
function cellToBoolean(value) {
    if (value === null || value === undefined || value === '') {
        return false;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    const str = String(value).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'x' || str === 'yes';
}

/**
 * Parses Week column value into array of week numbers
 * @param {*} value - Week column value (e.g. "1,2,3,4" or "1, 2, 3")
 * @returns {number[]} Array of week numbers
 */
function parseWeeks(value) {
    if (!value) {
        return [];
    }
    const str = String(value).trim();
    if (!str) {
        return [];
    }
    return str.split(',')
        .map(w => w.trim())
        .filter(w => w.length > 0)
        .map(w => {
            const num = parseInt(w, 10);
            if (isNaN(num) || num < 1 || num > 5) {
                throw new Error(`Invalid week number: ${w}. Must be between 1 and 5.`);
            }
            return num;
        });
}

/**
 * Parses Excel file into route objects
 * 
 * @param {File|ArrayBuffer|string} fileInput - Excel file (File object, ArrayBuffer, or data URL)
 * @returns {Promise<Array>} Array of route objects
 * @throws {Error} If file cannot be parsed or required columns are missing
 * 
 * @example
 * const routes = await parseRouteTemplate(excelFile);
 * // Returns: [{ customer: "ABC Corp", address: "123 Main St", suburb: "Cape Town", days: { mon: true, tue: false, ... }, weeks: [1,2,3,4] }]
 */
async function parseRouteTemplate(fileInput) {
    // Load SheetJS if needed
    await loadSheetJS();

    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS (XLSX) library is not available');
    }

    // Convert file input to ArrayBuffer
    let arrayBuffer;
    if (fileInput instanceof File) {
        arrayBuffer = await fileInput.arrayBuffer();
    } else if (fileInput instanceof ArrayBuffer) {
        arrayBuffer = fileInput;
    } else if (typeof fileInput === 'string' && fileInput.startsWith('data:')) {
        // Data URL - extract base64 and convert
        const base64 = fileInput.split(',')[1];
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
    } else {
        throw new Error('Invalid file input. Expected File, ArrayBuffer, or data URL.');
    }

    // Read Excel file
    let workbook;
    try {
        workbook = XLSX.read(arrayBuffer, { type: 'array' });
    } catch (error) {
        throw new Error(`Failed to read Excel file: ${error.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Empty Excel file or no worksheets found');
    }

    // Get first worksheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert worksheet to JSON array format
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: null,
        raw: false 
    });

    if (!jsonData || jsonData.length === 0) {
        throw new Error('Empty Excel file or no data rows found');
    }

    // First row is headers
    const headerRow = jsonData[0];
    if (!headerRow || headerRow.length === 0) {
        throw new Error('Excel file has no header row');
    }

    // Find required column indices
    const customerIdx = findColumnIndex(headerRow, 'Customer');
    const addressIdx = findColumnIndex(headerRow, 'Address');
    const suburbIdx = findColumnIndex(headerRow, 'Suburb');
    const mondayIdx = findColumnIndex(headerRow, 'Monday');
    const tuesdayIdx = findColumnIndex(headerRow, 'Tuesday');
    const wednesdayIdx = findColumnIndex(headerRow, 'Wednesday');
    const thursdayIdx = findColumnIndex(headerRow, 'Thursday');
    const fridayIdx = findColumnIndex(headerRow, 'Friday');
    const saturdayIdx = findColumnIndex(headerRow, 'Saturday');
    const weekIdx = findColumnIndex(headerRow, 'Week');

    // Validate required columns
    const missingColumns = [];
    if (customerIdx === null) missingColumns.push('Customer');
    if (addressIdx === null) missingColumns.push('Address');
    if (suburbIdx === null) missingColumns.push('Suburb');
    if (mondayIdx === null) missingColumns.push('Monday');
    if (tuesdayIdx === null) missingColumns.push('Tuesday');
    if (wednesdayIdx === null) missingColumns.push('Wednesday');
    if (thursdayIdx === null) missingColumns.push('Thursday');
    if (fridayIdx === null) missingColumns.push('Friday');
    if (saturdayIdx === null) missingColumns.push('Saturday');
    if (weekIdx === null) missingColumns.push('Week');

    if (missingColumns.length > 0) {
        throw new Error(`Missing required column(s): ${missingColumns.join(', ')}`);
    }

    // Parse data rows
    const routes = [];
    for (let rowIdx = 1; rowIdx < jsonData.length; rowIdx++) {
        const row = jsonData[rowIdx];
        if (!row || row.length === 0) {
            continue; // Skip empty rows
        }

        // Extract values
        const customer = row[customerIdx] ? String(row[customerIdx]).trim() : '';
        const address = row[addressIdx] ? String(row[addressIdx]).trim() : '';
        const suburb = row[suburbIdx] ? String(row[suburbIdx]).trim() : '';

        // Validate required fields
        if (!customer || !address || !suburb) {
            // Skip rows with missing required data
            continue;
        }

        // Parse day checkboxes
        const days = {
            mon: cellToBoolean(row[mondayIdx]),
            tue: cellToBoolean(row[tuesdayIdx]),
            wed: cellToBoolean(row[wednesdayIdx]),
            thu: cellToBoolean(row[thursdayIdx]),
            fri: cellToBoolean(row[fridayIdx]),
            sat: cellToBoolean(row[saturdayIdx])
        };

        // Parse weeks
        let weeks = [];
        try {
            weeks = parseWeeks(row[weekIdx]);
        } catch (error) {
            throw new Error(`Invalid Week format in row ${rowIdx + 1}: ${row[weekIdx]}. ${error.message}`);
        }

        if (weeks.length === 0) {
            // Skip routes with no weeks specified
            continue;
        }

        routes.push({
            customer,
            address,
            suburb,
            days,
            weeks
        });
    }

    if (routes.length === 0) {
        throw new Error('No valid route data found in Excel file. Ensure rows have Customer, Address, Suburb, and Week values.');
    }

    return routes;
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseRouteTemplate, loadSheetJS };
}

// Make available globally
if (typeof window !== 'undefined') {
    window.parseRouteTemplate = parseRouteTemplate;
    window.loadSheetJS = loadSheetJS;
}

