/**
 * Engagement Period Service for ClearTrack
 * 
 * Manages employment/engagement period data for users.
 * Handles creation, ending, and retrieval of engagement periods with validation.
 * 
 * Data Model:
 * {
 *   id: string,
 *   userId: string,
 *   role: "employee" | "sales_rep" | "contractor" | "business_owner",
 *   startDate: "YYYY-MM-DD",
 *   endDate: "YYYY-MM-DD" | null,
 *   status: "active" | "ended",
 *   endReason: null | "resigned" | "retrenchment" | "dismissal" | "contract_ended" | "business_closed",
 *   employerName?: string,
 *   createdBy: "user" | "practitioner" | "admin",
 *   lockedByPractitioner: boolean,
 *   createdAt: timestamp,
 *   updatedAt: timestamp
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

  /**
   * Check if current user is a practitioner or admin
   * @private
   * @returns {Promise<boolean>} True if user is practitioner or admin
   */
  async function isCurrentUserPractitionerOrAdmin() {
    const { db, currentUserId } = ensureFirebase();
    
    try {
      const userDoc = await db.collection('users').doc(currentUserId).get();
      if (!userDoc.exists) {
        return false;
      }
      
      const userData = userDoc.data();
      const role = String(userData.role || '').toLowerCase().trim();
      return role === 'practitioner' || role === 'admin';
    } catch (error) {
      console.error('[engagement-service] Error checking user role:', error);
      return false;
    }
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

  // Helper to convert document to engagement period object
  function docToEngagementPeriod(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId || '',
      role: data.role || 'employee',
      startDate: data.startDate || '',
      endDate: data.endDate || null,
      status: data.status || 'active',
      endReason: data.endReason || null,
      employerName: data.employerName || undefined,
      createdBy: data.createdBy || 'user',
      lockedByPractitioner: data.lockedByPractitioner || false,
      createdAt: timestampToISO(data.createdAt),
      updatedAt: timestampToISO(data.updatedAt)
    };
  }

  // ========== INTERNAL VALIDATION HELPERS ==========
  
  /**
   * Internal helper: Check if two date ranges overlap
   * @private
   */
  function datesOverlap(start1, end1, start2, end2) {
    // Convert to Date objects for comparison
    const s1 = new Date(start1);
    const e1 = end1 ? new Date(end1) : new Date('9999-12-31'); // null endDate means ongoing
    const s2 = new Date(start2);
    const e2 = end2 ? new Date(end2) : new Date('9999-12-31');
    
    // Check if periods overlap: start1 < end2 && start2 < end1
    return s1 < e2 && s2 < e1;
  }

  /**
   * Internal validation: Validate date order (endDate >= startDate)
   * Throws descriptive error if validation fails.
   * @private
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string|null} endDate - End date in YYYY-MM-DD format or null
   * @throws {Error} If endDate is before startDate
   */
  function validateDateOrder(startDate, endDate) {
    if (endDate === null || endDate === undefined) {
      return; // null endDate is valid (ongoing engagement)
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      throw new Error('End date cannot be before start date');
    }
  }

  /**
   * Internal validation: Ensure only one active engagement per user
   * Throws descriptive error if validation fails.
   * @private
   * @param {string} userId - User ID to validate
   * @param {string} [excludeId] - Optional engagement ID to exclude from check (for updates)
   * @throws {Error} If user already has an active engagement
   */
  async function validateSingleActive(userId, excludeId = null) {
    const { db } = ensureFirebase();
    
    const activeEngagements = await db.collection('engagementPeriods')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();
    
    if (excludeId) {
      // When updating, exclude the current engagement from the check
      const filtered = activeEngagements.docs.filter(doc => doc.id !== excludeId);
      if (filtered.length > 0) {
        throw new Error('User already has an active engagement period');
      }
    } else {
      // When creating new, no active engagements should exist
      if (!activeEngagements.empty) {
        throw new Error('User already has an active engagement period');
      }
    }
  }

  /**
   * Internal validation: Ensure engagement periods do not overlap
   * Throws descriptive error if validation fails.
   * @private
   * @param {string} userId - User ID to validate
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string|null} endDate - End date in YYYY-MM-DD format or null
   * @param {string} [excludeId] - Optional engagement ID to exclude from check (for updates)
   * @throws {Error} If engagement overlaps with existing period
   */
  async function validateNoOverlap(userId, startDate, endDate, excludeId = null) {
    const { db } = ensureFirebase();
    
    const allEngagements = await db.collection('engagementPeriods')
      .where('userId', '==', userId)
      .get();
    
    for (const doc of allEngagements.docs) {
      if (excludeId && doc.id === excludeId) {
        continue; // Skip the current engagement being updated
      }
      
      const existing = doc.data();
      const existingStart = existing.startDate;
      const existingEnd = existing.endDate || null;
      
      if (datesOverlap(startDate, endDate, existingStart, existingEnd)) {
        const existingRange = existingEnd 
          ? `${existingStart} to ${existingEnd}`
          : `${existingStart} (ongoing)`;
        throw new Error(`Engagement periods may not overlap. This period conflicts with an existing period: ${existingRange}`);
      }
    }
  }

  /**
   * Internal validation: Check if engagement is locked by practitioner
   * Throws descriptive error if validation fails.
   * Practitioners and admins can edit locked engagements.
   * @private
   * @param {string} engagementId - Engagement period ID
   * @throws {Error} If engagement is locked and user is not practitioner/admin
   */
  async function validateNotLocked(engagementId) {
    const { db } = ensureFirebase();
    
    const doc = await db.collection('engagementPeriods').doc(engagementId).get();
    if (!doc.exists) {
      throw new Error('Engagement period not found');
    }
    
    const data = doc.data();
    if (data.lockedByPractitioner === true) {
      // Check if current user is practitioner or admin
      const isPractitioner = await isCurrentUserPractitionerOrAdmin();
      if (!isPractitioner) {
        throw new Error('This engagement is locked by a practitioner');
      }
      // Practitioner/admin can edit locked engagements - validation passes
    }
  }

  /**
   * Internal validation: Check date format
   * @private
   */
  function validateDateFormat(date, fieldName) {
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }
  }

  // Validation: Check role value
  function validateRole(role) {
    const validRoles = ['employee', 'sales_rep', 'contractor', 'business_owner'];
    if (!validRoles.includes(role)) {
      throw new Error(`role must be one of: ${validRoles.join(', ')}`);
    }
  }

  // Validation: Check endReason value
  function validateEndReason(endReason) {
    if (endReason === null || endReason === undefined) {
      return; // null is valid
    }
    
    const validReasons = ['resigned', 'retrenchment', 'dismissal', 'contract_ended', 'business_closed'];
    if (!validReasons.includes(endReason)) {
      throw new Error(`endReason must be one of: ${validReasons.join(', ')} or null`);
    }
  }

  // Validation: Check createdBy value
  function validateCreatedBy(createdBy) {
    const validCreators = ['user', 'practitioner', 'admin'];
    if (!validCreators.includes(createdBy)) {
      throw new Error(`createdBy must be one of: ${validCreators.join(', ')}`);
    }
  }

  /**
   * Create a new engagement period
   * All validations run BEFORE Firestore write.
   * @param {string} userId - User ID
   * @param {Object} data - Engagement period data
   * @param {string} data.role - Role type
   * @param {string} data.startDate - Start date (YYYY-MM-DD)
   * @param {string|null} [data.endDate] - End date (YYYY-MM-DD) or null
   * @param {string} [data.employerName] - Employer name (optional)
   * @param {string} [data.createdBy] - Creator type (default: 'user')
   * @param {boolean} [data.lockedByPractitioner] - Lock status (default: false)
   * @returns {Promise<Object>} Created engagement period
   * @throws {Error} If validation fails
   */
  async function createEngagementPeriod(userId, data) {
    const { db } = ensureFirebase();
    
    // ========== VALIDATION PHASE (BEFORE ANY FIRESTORE WRITES) ==========
    
    // Validate required fields
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!data || !data.role || !data.startDate) {
      throw new Error('role and startDate are required');
    }
    
    // Validate date format
    validateDateFormat(data.startDate, 'startDate');
    if (data.endDate !== null && data.endDate !== undefined) {
      validateDateFormat(data.endDate, 'endDate');
    }
    
    // Validate date order (endDate >= startDate)
    validateDateOrder(data.startDate, data.endDate || null);
    
    // Validate field values
    validateRole(data.role);
    if (data.createdBy) {
      validateCreatedBy(data.createdBy);
    }
    if (data.endReason) {
      validateEndReason(data.endReason);
    }
    
    // Determine status
    const status = data.endDate ? 'ended' : 'active';
    
    // Validate single active engagement (if creating active engagement)
    if (status === 'active') {
      await validateSingleActive(userId);
    }
    
    // Validate no overlapping dates (always check, even for ended engagements)
    await validateNoOverlap(userId, data.startDate, data.endDate || null);
    
    // ========== FIRESTORE WRITE PHASE (ALL VALIDATIONS PASSED) ==========
    
    // Prepare engagement period data
    const engagementData = {
      userId: userId,
      role: data.role,
      startDate: data.startDate,
      endDate: data.endDate || null,
      status: status,
      endReason: data.endReason || null,
      employerName: data.employerName || undefined,
      createdBy: data.createdBy || 'user',
      lockedByPractitioner: data.lockedByPractitioner || false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Remove undefined fields
    Object.keys(engagementData).forEach(key => {
      if (engagementData[key] === undefined) {
        delete engagementData[key];
      }
    });
    
    // Create document in Firestore
    const docRef = await db.collection('engagementPeriods').add(engagementData);
    const doc = await docRef.get();
    
    return docToEngagementPeriod(doc);
  }

  /**
   * End an engagement period
   * All validations run BEFORE Firestore write.
   * @param {string} engagementId - Engagement period ID
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {string} endReason - Reason for ending
   * @returns {Promise<Object>} Updated engagement period
   * @throws {Error} If validation fails
   */
  async function endEngagementPeriod(engagementId, endDate, endReason) {
    const { db } = ensureFirebase();
    
    // ========== VALIDATION PHASE (BEFORE ANY FIRESTORE WRITES) ==========
    
    // Validate required fields
    if (!engagementId) {
      throw new Error('engagementId is required');
    }
    if (!endDate) {
      throw new Error('endDate is required');
    }
    if (!endReason) {
      throw new Error('endReason is required');
    }
    
    // Validate date format
    validateDateFormat(endDate, 'endDate');
    
    // Validate endReason value
    validateEndReason(endReason);
    
    // Check if engagement exists and is locked (read-only check)
    const doc = await db.collection('engagementPeriods').doc(engagementId).get();
    if (!doc.exists) {
      throw new Error('Engagement period not found');
    }
    
    const current = doc.data();
    
    // Validate engagement is not locked (allows practitioners/admins to edit)
    await validateNotLocked(engagementId);
    
    // Validate date order (endDate >= startDate)
    validateDateOrder(current.startDate, endDate);
    
    // ========== FIRESTORE WRITE PHASE (ALL VALIDATIONS PASSED) ==========
    
    // Update engagement period
    await db.collection('engagementPeriods').doc(engagementId).update({
      endDate: endDate,
      endReason: endReason,
      status: 'ended',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Return updated document
    const updatedDoc = await db.collection('engagementPeriods').doc(engagementId).get();
    return docToEngagementPeriod(updatedDoc);
  }

  /**
   * Get all engagement periods for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} Array of engagement periods
   */
  async function getEngagementPeriodsForUser(userId) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required.');
    }
    
    const snapshot = await db.collection('engagementPeriods')
      .where('userId', '==', userId)
      .orderBy('startDate', 'desc')
      .get();
    
    return snapshot.docs.map(doc => docToEngagementPeriod(doc));
  }

  /**
   * Get the active engagement period for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Active engagement period or null
   */
  async function getActiveEngagementPeriod(userId) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required.');
    }
    
    const snapshot = await db.collection('engagementPeriods')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return docToEngagementPeriod(snapshot.docs[0]);
  }

  /**
   * Lock an engagement period (practitioner/admin only)
   * Prevents user edits while allowing practitioner edits.
   * 
   * @param {string} engagementId - Engagement period ID
   * @returns {Promise<Object>} Updated engagement period
   * @throws {Error} If user is not practitioner/admin or engagement not found
   */
  async function lockEngagementPeriod(engagementId) {
    const { db } = ensureFirebase();
    
    if (!engagementId) {
      throw new Error('engagementId is required');
    }
    
    // Check if current user is practitioner or admin
    const isPractitioner = await isCurrentUserPractitionerOrAdmin();
    if (!isPractitioner) {
      throw new Error('Only practitioners and admins can lock engagement periods');
    }
    
    // Check if engagement exists
    const doc = await db.collection('engagementPeriods').doc(engagementId).get();
    if (!doc.exists) {
      throw new Error('Engagement period not found');
    }
    
    // Update engagement to lock it
    await db.collection('engagementPeriods').doc(engagementId).update({
      lockedByPractitioner: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Return updated document
    const updatedDoc = await db.collection('engagementPeriods').doc(engagementId).get();
    return docToEngagementPeriod(updatedDoc);
  }

  /**
   * Get effective logbook date ranges for a user within a tax year
   * Returns the intersection of engagement periods with the tax year boundaries.
   * Used by logbook generation pipeline to determine valid date ranges.
   * 
   * @param {string} userId - User ID
   * @param {Object} taxYear - Tax year date range
   * @param {string} taxYear.start - Start date in YYYY-MM-DD format
   * @param {string} taxYear.end - End date in YYYY-MM-DD format
   * @returns {Promise<Array<Object>>} Array of effective date ranges
   * @returns {Array<Object>} Each object contains:
   *   - engagementId: string
   *   - role: string
   *   - startDate: string (YYYY-MM-DD) - max of taxYear.start and engagement.startDate
   *   - endDate: string (YYYY-MM-DD) - min of taxYear.end and engagement.endDate (or taxYear.end if ongoing)
   * 
   * Returns empty array if no engagement periods exist (no error thrown).
   */
  async function getEffectiveLogbookDateRange(userId, taxYear) {
    const { db } = ensureFirebase();
    
    // Validate inputs
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!taxYear || !taxYear.start || !taxYear.end) {
      throw new Error('taxYear must have start and end properties in YYYY-MM-DD format');
    }
    
    // Validate tax year date format
    validateDateFormat(taxYear.start, 'taxYear.start');
    validateDateFormat(taxYear.end, 'taxYear.end');
    
    // Validate tax year date order
    validateDateOrder(taxYear.start, taxYear.end);
    
    // Fetch all engagement periods for the user (active and historical)
    const snapshot = await db.collection('engagementPeriods')
      .where('userId', '==', userId)
      .orderBy('startDate', 'asc')
      .get();
    
    // If no engagements exist, return empty array (no error)
    if (snapshot.empty) {
      return [];
    }
    
    // Convert tax year dates to Date objects for comparison
    const taxYearStart = new Date(taxYear.start);
    const taxYearEnd = new Date(taxYear.end);
    
    // Process each engagement period and calculate intersection with tax year
    const effectiveRanges = [];
    
    for (const doc of snapshot.docs) {
      const engagement = docToEngagementPeriod(doc);
      const engagementStart = new Date(engagement.startDate);
      const engagementEnd = engagement.endDate ? new Date(engagement.endDate) : null;
      
      // Calculate intersection: max(taxYear.start, engagement.startDate) to min(taxYear.end, engagement.endDate ?? taxYear.end)
      const effectiveStart = engagementStart > taxYearStart ? engagementStart : taxYearStart;
      const effectiveEnd = engagementEnd 
        ? (engagementEnd < taxYearEnd ? engagementEnd : taxYearEnd)
        : taxYearEnd;
      
      // Only include if there's an actual overlap (effectiveStart <= effectiveEnd)
      if (effectiveStart <= effectiveEnd) {
        // Format dates back to YYYY-MM-DD
        const formatDate = (date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        effectiveRanges.push({
          engagementId: engagement.id,
          role: engagement.role,
          startDate: formatDate(effectiveStart),
          endDate: formatDate(effectiveEnd)
        });
      }
    }
    
    return effectiveRanges;
  }

  // Export service object
  const engagementService = {
    createEngagementPeriod,
    endEngagementPeriod,
    lockEngagementPeriod,
    getEngagementPeriodsForUser,
    getActiveEngagementPeriod,
    getEffectiveLogbookDateRange
  };

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engagementService;
  }

  // Export globally
  if (typeof window !== 'undefined') {
    window.engagementService = engagementService;
  }

})();

