/**
 * Tax Year Service for ClearTrack
 * 
 * Manages tax year data objects for users.
 * Handles creation, retrieval, and gap detection for tax years.
 * 
 * Data Model:
 * {
 *   id: string,                    // Format: "2024-2025" (startYear-endYear)
 *   userId: string,
 *   startDate: "YYYY-MM-DD",       // March 1 of start year
 *   endDate: "YYYY-MM-DD",          // Feb 28/29 of end year
 *   status: "open" | "submitted" | "locked",
 *   createdAt: timestamp,
 *   createdBy: "system" | "practitioner",
 *   submittedAt: timestamp | null,
 *   lockedAt: timestamp | null,
 *   lockedBy: string | null         // practitionerId if locked
 * }
 */

(function() {
  'use strict';

  // Check if Firebase is available
  function ensureFirebase() {
    if (!window.firebaseDb || !window.firebaseAuth) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    if (!window.firebaseAuth.currentUser) {
      throw new Error('User must be authenticated to perform this operation.');
    }
    return {
      db: window.firebaseDb,
      auth: window.firebaseAuth,
      currentUserId: window.firebaseAuth.currentUser.uid
    };
  }

  // Helper to convert Firestore timestamp to ISO string
  function timestampToISO(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toDate) {
      return timestamp.toDate().toISOString();
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    return timestamp;
  }

  // Helper to convert document to tax year object
  function docToTaxYear(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId || '',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      status: data.status || 'open',
      createdAt: timestampToISO(data.createdAt),
      createdBy: data.createdBy || 'system',
      submittedAt: timestampToISO(data.submittedAt),
      lockedAt: timestampToISO(data.lockedAt),
      lockedBy: data.lockedBy || null
    };
  }

  // ========== INTERNAL VALIDATION HELPERS ==========
  
  /**
   * Internal validation: Check date format
   * @private
   */
  function validateDateFormat(date, fieldName) {
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }
  }

  /**
   * Internal validation: Validate date order (endDate >= startDate)
   * Throws descriptive error if validation fails.
   * @private
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @throws {Error} If endDate is before startDate
   */
  function validateDateOrder(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      throw new Error('End date cannot be before start date');
    }
  }

  /**
   * Internal validation: Check if tax year overlaps with existing tax years
   * @private
   * @param {string} userId - User ID
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {string} [excludeId] - Optional tax year ID to exclude from check (for updates)
   * @throws {Error} If tax year overlaps with existing tax year
   */
  async function validateNoOverlap(userId, startDate, endDate, excludeId = null) {
    const { db } = ensureFirebase();
    
    const allTaxYears = await db.collection('taxYears')
      .where('userId', '==', userId)
      .get();
    
    for (const doc of allTaxYears.docs) {
      if (excludeId && doc.id === excludeId) {
        continue; // Skip the current tax year being updated
      }
      
      const existing = doc.data();
      const existingStart = existing.startDate;
      const existingEnd = existing.endDate;
      
      // Check if periods overlap: start1 < end2 && start2 < end1
      const s1 = new Date(startDate);
      const e1 = new Date(endDate);
      const s2 = new Date(existingStart);
      const e2 = new Date(existingEnd);
      
      if (s1 < e2 && s2 < e1) {
        throw new Error(`Tax year overlaps with existing tax year: ${existingStart} to ${existingEnd}`);
      }
    }
  }

  /**
   * Internal validation: Check status value
   * @private
   */
  function validateStatus(status) {
    const validStatuses = ['open', 'submitted', 'locked'];
    if (!validStatuses.includes(status)) {
      throw new Error(`status must be one of: ${validStatuses.join(', ')}`);
    }
  }

  /**
   * Internal validation: Check createdBy value
   * @private
   */
  function validateCreatedBy(createdBy) {
    const validCreators = ['system', 'practitioner'];
    if (!validCreators.includes(createdBy)) {
      throw new Error(`createdBy must be one of: ${validCreators.join(', ')}`);
    }
  }

  // ========== HELPER FUNCTIONS ==========

  /**
   * Calculate tax year dates from year number
   * South African tax year: March 1 to February 28/29
   * @param {number} year - Tax year start year (e.g., 2024 for 2024-2025)
   * @returns {Object} Object with start and end dates in YYYY-MM-DD format
   */
  function calculateTaxYearDates(year) {
    const start = `${year}-03-01`;
    const nextYear = year + 1;
    const isLeapYear = new Date(nextYear, 1, 29).getDate() === 29;
    const end = `${nextYear}-02-${isLeapYear ? '29' : '28'}`;
    return { start, end };
  }

  /**
   * Generate tax year ID from dates
   * Format: "YYYY-YYYY" (e.g., "2024-2025")
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {string} Tax year ID
   */
  function getTaxYearId(startDate, endDate) {
    const startYear = parseInt(startDate.split('-')[0]);
    const endYear = parseInt(endDate.split('-')[0]);
    return `${startYear}-${endYear}`;
  }

  /**
   * Validate tax year dates
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @throws {Error} If validation fails
   */
  function validateTaxYearDates(startDate, endDate) {
    validateDateFormat(startDate, 'startDate');
    validateDateFormat(endDate, 'endDate');
    validateDateOrder(startDate, endDate);
    
    // Validate that start date is March 1
    const startParts = startDate.split('-');
    if (startParts[1] !== '03' || startParts[2] !== '01') {
      throw new Error('startDate must be March 1 (YYYY-03-01)');
    }
    
    // Validate that end date is February 28 or 29
    const endParts = endDate.split('-');
    if (endParts[1] !== '02' || (endParts[2] !== '28' && endParts[2] !== '29')) {
      throw new Error('endDate must be February 28 or 29 (YYYY-02-28 or YYYY-02-29)');
    }
    
    // Validate that end year is start year + 1
    const startYear = parseInt(startParts[0]);
    const endYear = parseInt(endParts[0]);
    if (endYear !== startYear + 1) {
      throw new Error('endDate year must be startDate year + 1');
    }
  }

  /**
   * Check if tax year overlaps with existing tax years
   * @param {Array} existingYears - Array of existing tax year objects
   * @param {string} newStart - New start date in YYYY-MM-DD format
   * @param {string} newEnd - New end date in YYYY-MM-DD format
   * @returns {boolean} True if overlapping
   */
  function isTaxYearOverlapping(existingYears, newStart, newEnd) {
    const s1 = new Date(newStart);
    const e1 = new Date(newEnd);
    
    for (const existing of existingYears) {
      const s2 = new Date(existing.startDate);
      const e2 = new Date(existing.endDate);
      
      // Check if periods overlap: start1 < end2 && start2 < end1
      if (s1 < e2 && s2 < e1) {
        return true;
      }
    }
    
    return false;
  }

  // ========== PUBLIC API FUNCTIONS ==========

  /**
   * Create a new tax year document
   * @param {string} userId - User ID
   * @param {string} startDate - Start date in YYYY-MM-DD format (must be March 1)
   * @param {string} endDate - End date in YYYY-MM-DD format (must be Feb 28/29)
   * @param {string} [createdBy="system"] - Creator type (default: "system")
   * @returns {Promise<Object>} Created tax year object
   * @throws {Error} If validation fails
   */
  async function createTaxYear(userId, startDate, endDate, createdBy = "system") {
    const { db } = ensureFirebase();
    
    // ========== VALIDATION PHASE (BEFORE ANY FIRESTORE WRITES) ==========
    
    // Validate required fields
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }
    
    // Validate date format and structure
    validateTaxYearDates(startDate, endDate);
    
    // Validate createdBy
    validateCreatedBy(createdBy);
    
    // Check for overlaps
    await validateNoOverlap(userId, startDate, endDate);
    
    // ========== CREATE DOCUMENT ==========
    
    const taxYearId = getTaxYearId(startDate, endDate);
    
    // Check if tax year already exists
    const existingDoc = await db.collection('taxYears')
      .where('userId', '==', userId)
      .where('id', '==', taxYearId)
      .get();
    
    if (!existingDoc.empty) {
      throw new Error(`Tax year ${taxYearId} already exists for this user`);
    }
    
    const taxYearData = {
      id: taxYearId,
      userId: userId,
      startDate: startDate,
      endDate: endDate,
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: createdBy,
      submittedAt: null,
      lockedAt: null,
      lockedBy: null
    };
    
    await db.collection('taxYears').doc(taxYearId).set(taxYearData);
    
    // Return created tax year
    const createdDoc = await db.collection('taxYears').doc(taxYearId).get();
    return docToTaxYear(createdDoc);
  }

  /**
   * Get all tax years for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} Array of tax year objects, ordered by startDate descending
   */
  async function getTaxYearsForUser(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const { db } = ensureFirebase();
    
    try {
      const snapshot = await db.collection('taxYears')
        .where('userId', '==', userId)
        .orderBy('startDate', 'desc')
        .get();
      
      return snapshot.docs.map(doc => docToTaxYear(doc));
    } catch (error) {
      console.error('[tax-year-service] Error getting tax years:', error);
      throw error;
    }
  }

  /**
   * Get the current active tax year (calculated, not stored)
   * Uses existing calculation pattern (March 1 - Feb 28/29)
   * Does NOT create a document, only returns calculated object
   * Co-exists with existing loadClientTaxYearContext() logic
   * @param {string} userId - User ID (for consistency, not used in calculation)
   * @returns {Object} Current tax year object (calculated)
   */
  function getActiveTaxYear(userId) {
    // Calculate current tax year using existing pattern
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    let startDate, endDate, label;
    
    if (currentMonth >= 3) {
      // March onwards - current year to next year
      startDate = `${currentYear}-03-01`;
      const nextYear = currentYear + 1;
      const isLeapYear = new Date(nextYear, 1, 29).getDate() === 29;
      endDate = `${nextYear}-02-${isLeapYear ? '29' : '28'}`;
      label = `${currentYear}-${currentYear + 1}`;
    } else {
      // Jan/Feb - previous year to current year
      startDate = `${currentYear - 1}-03-01`;
      const isLeapYear = new Date(currentYear, 1, 29).getDate() === 29;
      endDate = `${currentYear}-02-${isLeapYear ? '29' : '28'}`;
      label = `${currentYear - 1}-${currentYear}`;
    }
    
    return {
      id: getTaxYearId(startDate, endDate),
      userId: userId,
      startDate: startDate,
      endDate: endDate,
      label: label,
      status: 'open', // Calculated, not stored
      createdAt: null,
      createdBy: 'system',
      submittedAt: null,
      lockedAt: null,
      lockedBy: null
    };
  }

  /**
   * Get missing tax years for a user
   * Compares earliest engagement start date with current systemic tax year
   * Identifies gaps between existing tax year documents
   * Does NOT auto-create missing years
   * Does NOT render UI
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Object with existingYears and missingYears arrays
   */
  async function getMissingTaxYears(userId) {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    // Get all engagement periods for user
    if (!window.engagementService || !window.engagementService.getEngagementPeriodsForUser) {
      throw new Error('Engagement service is not available');
    }
    
    const engagements = await window.engagementService.getEngagementPeriodsForUser(userId);
    
    if (!engagements || engagements.length === 0) {
      // No engagements, return current tax year only
      const activeTaxYear = getActiveTaxYear(userId);
      const existingYears = await getTaxYearsForUser(userId);
      return {
        existingYears: existingYears,
        missingYears: []
      };
    }
    
    // Find earliest engagement start date
    let earliestStart = null;
    for (const engagement of engagements) {
      if (engagement.startDate) {
        const startDate = new Date(engagement.startDate);
        if (!earliestStart || startDate < earliestStart) {
          earliestStart = startDate;
        }
      }
    }
    
    if (!earliestStart) {
      // No valid start dates, return current tax year only
      const activeTaxYear = getActiveTaxYear(userId);
      const existingYears = await getTaxYearsForUser(userId);
      return {
        existingYears: existingYears,
        missingYears: []
      };
    }
    
    // Get current systemic tax year
    const activeTaxYear = getActiveTaxYear(userId);
    const activeStart = new Date(activeTaxYear.startDate);
    
    // Get existing tax years
    const existingYears = await getTaxYearsForUser(userId);
    
    // Generate all tax years from earliest engagement to current
    const allPossibleYears = [];
    let currentYear = earliestStart.getFullYear();
    const currentTaxYearStart = activeStart.getFullYear();
    
    // If earliest engagement is before March, use previous year as start
    if (earliestStart.getMonth() < 2) { // Month 0-11, so 2 = March
      currentYear = currentYear - 1;
    }
    
    while (currentYear <= currentTaxYearStart) {
      const dates = calculateTaxYearDates(currentYear);
      allPossibleYears.push({
        id: getTaxYearId(dates.start, dates.end),
        startDate: dates.start,
        endDate: dates.end,
        label: `${currentYear}-${currentYear + 1}`
      });
      currentYear++;
    }
    
    // Find missing years
    const existingIds = new Set(existingYears.map(ty => ty.id));
    const missingYears = allPossibleYears.filter(ty => !existingIds.has(ty.id));
    
    return {
      existingYears: existingYears,
      missingYears: missingYears
    };
  }

  // ========== EXPORT PUBLIC API ==========

  window.taxYearService = {
    createTaxYear: createTaxYear,
    getTaxYearsForUser: getTaxYearsForUser,
    getActiveTaxYear: getActiveTaxYear,
    getMissingTaxYears: getMissingTaxYears,
    // Helper functions (exposed for testing/debugging)
    calculateTaxYearDates: calculateTaxYearDates,
    getTaxYearId: getTaxYearId,
    validateTaxYearDates: validateTaxYearDates,
    isTaxYearOverlapping: isTaxYearOverlapping
  };

  console.log('✅ Tax Year Service loaded');

})();

