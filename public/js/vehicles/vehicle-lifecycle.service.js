/**
 * Vehicle Lifecycle Service for ClearTrack
 * 
 * Manages vehicle lifecycle with support for multiple vehicles per user.
 * Enforces that only one vehicle can be active at a time, and requires
 * closing mileage before switching to a new active vehicle.
 * 
 * Integrates with existing Firestore vehicle storage model:
 * - Firestore: users/{userId}/vehicles/{vehicleId}
 * - localStorage: via cleartrackData (fallback)
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

  // Helper to convert document to vehicle object with lifecycle fields
  function docToVehicle(doc) {
    const data = doc.data();
    
    // Determine startedAt with fallbacks for existing records
    let startedAt = data.startedAt;
    if (!startedAt) {
      if (data.addedAt) {
        const addedDate = data.addedAt.toDate ? data.addedAt.toDate() : new Date(data.addedAt);
        startedAt = formatDate(addedDate);
      } else {
        startedAt = formatDate(new Date());
      }
    }
    
    // Determine status with fallback for existing records
    let status = data.status;
    if (!status) {
      status = data.endedAt ? 'inactive' : 'active';
    }
    
    return {
      id: doc.id,
      userId: data.userId || '',
      label: data.label || undefined,
      regNumber: data.regNumber || data.registration || '',
      make: data.make || undefined,
      model: data.model || undefined,
      year: data.year || undefined,
      startedAt: startedAt,
      endedAt: data.endedAt || null,
      status: status,
      openingKm: data.openingKm !== undefined ? Number(data.openingKm) : 0,
      closingKm: data.closingKm !== undefined && data.closingKm !== null ? Number(data.closingKm) : null,
      createdAt: timestampToISO(data.createdAt || data.addedAt),
      updatedAt: timestampToISO(data.updatedAt)
    };
  }

  // Helper to format date to YYYY-MM-DD
  function formatDate(date) {
    if (!date) return null;
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Validation: Check date format
  function validateDateFormat(date, fieldName) {
    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
    }
  }

  // Validation: Check date order
  function validateDateOrder(startDate, endDate) {
    if (endDate === null || endDate === undefined) {
      return; // null endDate is valid
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new Error('End date cannot be before start date');
    }
  }

  // Validation: Check if dates overlap
  function datesOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1);
    const e1 = end1 ? new Date(end1) : new Date('9999-12-31');
    const s2 = new Date(start2);
    const e2 = end2 ? new Date(end2) : new Date('9999-12-31');
    return s1 < e2 && s2 < e1;
  }

  /**
   * Validate vehicle does not overlap with existing active vehicles within engagement periods
   * @private
   */
  async function validateNoOverlapWithEngagements(userId, vehicleStartDate, vehicleEndDate, excludeVehicleId = null) {
    const { db } = ensureFirebase();
    
    // Check if engagement service is available
    if (!window.engagementService || !window.engagementService.getEngagementPeriodsForUser) {
      // If engagement service not available, skip engagement validation (Phase 1 - optional)
      return;
    }
    
    try {
      // Get all engagement periods for the user (not just current tax year)
      const allEngagements = await window.engagementService.getEngagementPeriodsForUser(userId);
      
      // If no engagement periods, skip validation
      if (!allEngagements || allEngagements.length === 0) {
        return;
      }
      
      // Get all active vehicles for the user
      const vehiclesSnapshot = await db.collection('users').doc(userId)
        .collection('vehicles')
        .where('status', '==', 'active')
        .get();
      
      for (const vehicleDoc of vehiclesSnapshot.docs) {
        if (excludeVehicleId && vehicleDoc.id === excludeVehicleId) {
          continue;
        }
        
        const existingVehicle = docToVehicle(vehicleDoc);
        const existingStart = existingVehicle.startedAt;
        const existingEnd = existingVehicle.endedAt || null;
        
        // Check if vehicles overlap within any engagement period
        for (const engagement of allEngagements) {
          const engagementStart = new Date(engagement.startDate);
          const engagementEnd = engagement.endDate ? new Date(engagement.endDate) : new Date('9999-12-31');
          
          // Check if both vehicles are active within this engagement period
          const vehicleStart = new Date(vehicleStartDate);
          const vehicleEnd = vehicleEndDate ? new Date(vehicleEndDate) : new Date('9999-12-31');
          const existingVehicleStart = new Date(existingStart);
          const existingVehicleEnd = existingEnd ? new Date(existingEnd) : new Date('9999-12-31');
          
          // Check if both vehicles overlap with engagement period
          const vehicleInEngagement = vehicleStart <= engagementEnd && vehicleEnd >= engagementStart;
          const existingInEngagement = existingVehicleStart <= engagementEnd && existingVehicleEnd >= engagementStart;
          
          if (vehicleInEngagement && existingInEngagement) {
            // Both vehicles are within this engagement period, check for overlap
            if (datesOverlap(vehicleStartDate, vehicleEndDate, existingStart, existingEnd)) {
              throw new Error(`Vehicle active period overlaps with existing active vehicle "${existingVehicle.regNumber || existingVehicle.label || 'Unknown'}" within the same engagement period`);
            }
          }
        }
      }
    } catch (error) {
      // If engagement service error, re-throw if it's our validation error
      if (error.message && error.message.includes('overlaps')) {
        throw error;
      }
      // Otherwise, log and continue (engagement service might not be available)
      console.warn('[vehicle-lifecycle] Engagement validation skipped:', error.message);
    }
  }

  /**
   * Validate only one active vehicle per user
   * @private
   */
  async function validateSingleActiveVehicle(userId, excludeVehicleId = null) {
    const { db } = ensureFirebase();
    
    const activeVehicles = await db.collection('users').doc(userId)
      .collection('vehicles')
      .where('status', '==', 'active')
      .get();
    
    if (excludeVehicleId) {
      const filtered = activeVehicles.docs.filter(doc => doc.id !== excludeVehicleId);
      if (filtered.length > 0) {
        throw new Error('Only one active vehicle is allowed per user. Please close the existing active vehicle first.');
      }
    } else {
      if (!activeVehicles.empty) {
        throw new Error('Only one active vehicle is allowed per user. Please close the existing active vehicle first.');
      }
    }
  }

  /**
   * Validate active vehicle has closingKm set before activating new vehicle
   * @private
   */
  async function validateActiveVehicleClosed(userId) {
    const { db } = ensureFirebase();
    
    const activeVehicles = await db.collection('users').doc(userId)
      .collection('vehicles')
      .where('status', '==', 'active')
      .get();
    
    for (const doc of activeVehicles.docs) {
      const vehicle = docToVehicle(doc);
      if (vehicle.closingKm === null || vehicle.closingKm === undefined) {
        throw new Error('Close the current vehicle (enter closing mileage) before activating another vehicle');
      }
    }
  }

  /**
   * Validate vehicle dates fall within engagement periods
   * @private
   * @param {string} userId - User ID
   * @param {string} startedAt - Vehicle start date (YYYY-MM-DD)
   * @param {string|null} endedAt - Vehicle end date (YYYY-MM-DD) or null
   * @param {Object} [taxYear] - Optional tax year context { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
   * @throws {Error} If vehicle dates are outside engagement periods
   */
  async function validateVehicleWithinEngagement(userId, startedAt, endedAt = null, taxYear = null) {
    // Check if engagement service is available
    if (!window.engagementService || !window.engagementService.getEffectiveLogbookDateRange) {
      // If engagement service not available, skip validation
      return;
    }
    
    try {
      let engagementRanges = [];
      
      if (taxYear) {
        // Use tax year context to get effective engagement ranges
        engagementRanges = await window.engagementService.getEffectiveLogbookDateRange(userId, taxYear);
      } else {
        // Get all engagement periods for the user
        if (window.engagementService.getEngagementPeriodsForUser) {
          const allEngagements = await window.engagementService.getEngagementPeriodsForUser(userId);
          // Convert to ranges format
          engagementRanges = allEngagements.map(eng => ({
            engagementId: eng.id,
            role: eng.role,
            startDate: eng.startDate,
            endDate: eng.endDate || null
          }));
        }
      }
      
      // If no engagement periods exist, skip validation (user may not have engagements yet)
      if (!engagementRanges || engagementRanges.length === 0) {
        return;
      }
      
      const vehicleStart = new Date(startedAt);
      const vehicleEnd = endedAt ? new Date(endedAt) : new Date('9999-12-31');
      
      // Check if vehicle start date falls within at least one engagement range
      let startDateValid = false;
      let engagementEndDate = null;
      
      for (const range of engagementRanges) {
        const engagementStart = new Date(range.startDate);
        const engagementEnd = range.endDate ? new Date(range.endDate) : new Date('9999-12-31');
        
        // Check if vehicle start is within this engagement
        if (vehicleStart >= engagementStart && vehicleStart <= engagementEnd) {
          startDateValid = true;
          // Track the engagement end date for later validation
          if (range.endDate && (!engagementEndDate || new Date(range.endDate) < engagementEndDate)) {
            engagementEndDate = new Date(range.endDate);
          }
        }
        
        // Also check if vehicle end date is within this engagement
        if (endedAt && vehicleEnd >= engagementStart && vehicleEnd <= engagementEnd) {
          // Track the engagement end date
          if (range.endDate && (!engagementEndDate || new Date(range.endDate) < engagementEndDate)) {
            engagementEndDate = new Date(range.endDate);
          }
        }
      }
      
      // Validate start date (only if taxYear context is provided)
      if (taxYear && !startDateValid) {
        throw new Error('Vehicle start date is outside the user\'s engagement period');
      }
      
      // Validate end date doesn't exceed engagement end date
      if (endedAt && engagementEndDate && vehicleEnd > engagementEndDate) {
        throw new Error('Vehicle end date cannot be after employment end date');
      }
      
      // Validate end date doesn't exceed taxYear.end if provided
      if (endedAt && taxYear && taxYear.end) {
        const taxYearEnd = new Date(taxYear.end);
        if (vehicleEnd > taxYearEnd) {
          throw new Error('Vehicle end date cannot be after tax year end date');
        }
      }
    } catch (error) {
      // Re-throw validation errors
      if (error.message && (
        error.message.includes('outside') ||
        error.message.includes('after employment') ||
        error.message.includes('after tax year')
      )) {
        throw error;
      }
      // Otherwise, log and continue (engagement service might have issues)
      console.warn('[vehicle-lifecycle] Engagement validation error:', error.message);
    }
  }

  /**
   * Add a new vehicle
   * @param {string} userId - User ID
   * @param {Object} vehicleData - Vehicle data
   * @param {string} vehicleData.regNumber - Registration number (required)
   * @param {string} [vehicleData.label] - Vehicle label
   * @param {string} [vehicleData.make] - Vehicle make
   * @param {string} [vehicleData.model] - Vehicle model
   * @param {string} [vehicleData.year] - Vehicle year
   * @param {string} [vehicleData.startedAt] - Start date (YYYY-MM-DD, defaults to today)
   * @param {number} [vehicleData.openingKm] - Opening odometer reading (defaults to 0)
   * @param {number} [vehicleData.closingKmForPrevious] - Closing KM for previous active vehicle (required if active vehicle exists)
   * @param {Object} [vehicleData.taxYear] - Optional tax year context { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
   * @returns {Promise<Object>} Created vehicle
   * @description CT-PHASE3-MULTI-VEHICLE-SARS: Automatically closes active vehicle with no gaps between endDate and next startDate
   */
  async function addVehicle(userId, vehicleData) {
    const { db } = ensureFirebase();
    
    // Validate required fields
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!vehicleData || !vehicleData.regNumber) {
      throw new Error('regNumber is required');
    }
    
    // Set defaults
    const startedAt = vehicleData.startedAt ? formatDate(vehicleData.startedAt) : formatDate(new Date());
    const openingKm = vehicleData.openingKm !== undefined ? Number(vehicleData.openingKm) : 0;
    const taxYear = vehicleData.taxYear || null;
    
    // Validate date format
    if (vehicleData.startedAt) {
      validateDateFormat(startedAt, 'startedAt');
    }
    
    // Validate openingKm is a number
    if (isNaN(openingKm) || openingKm < 0) {
      throw new Error('openingKm must be a non-negative number');
    }
    
    // Validate vehicle dates fall within engagement periods (if taxYear context provided)
    if (taxYear) {
      await validateVehicleWithinEngagement(userId, startedAt, null, taxYear);
    }
    
    // Prepare vehicle data
    const vehicle = {
      userId: userId,
      regNumber: vehicleData.regNumber,
      label: vehicleData.label || undefined,
      make: vehicleData.make || undefined,
      model: vehicleData.model || undefined,
      year: vehicleData.year || undefined,
      startedAt: startedAt,
      endedAt: null,
      status: 'active',
      openingKm: openingKm,
      closingKm: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Remove undefined fields
    Object.keys(vehicle).forEach(key => {
      if (vehicle[key] === undefined) {
        delete vehicle[key];
      }
    });
    
    // CT-PHASE3-MULTI-VEHICLE-SARS: Auto-close active vehicle with no gaps
    // Get current active vehicle
    const activeVehicles = await db.collection('users').doc(userId)
      .collection('vehicles')
      .where('status', '==', 'active')
      .get();
    
    const batch = db.batch();
    
    if (!activeVehicles.empty) {
      // Close active vehicle(s) - ensure no gaps between vehicles
      for (const doc of activeVehicles.docs) {
        const activeVehicle = docToVehicle(doc);
        
        // Calculate endDate: day before new vehicle starts (no gaps)
        const newVehicleStartDate = new Date(startedAt);
        const previousEndDate = new Date(newVehicleStartDate);
        previousEndDate.setDate(previousEndDate.getDate() - 1);
        const previousEndDateStr = formatDate(previousEndDate);
        
        // Use provided closingKm or require it
        const closingKm = vehicleData.closingKmForPrevious !== undefined 
          ? Number(vehicleData.closingKmForPrevious)
          : activeVehicle.closingKm;
        
        if (closingKm === null || closingKm === undefined) {
          throw new Error(`Closing mileage is required for active vehicle "${activeVehicle.regNumber || 'Unknown'}" when adding a new vehicle. Please provide closingKmForPrevious.`);
        }
        
        // Validate closingKm > openingKm
        if (Number(closingKm) <= activeVehicle.openingKm) {
          throw new Error(`Closing mileage must be greater than opening mileage for vehicle "${activeVehicle.regNumber || 'Unknown'}"`);
        }
        
        // Update active vehicle to ended status
        batch.update(doc.ref, {
          endedAt: previousEndDateStr,
          status: 'ended',
          closingKm: Number(closingKm),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    // Validate no overlap with engagement periods
    await validateNoOverlapWithEngagements(userId, startedAt, null);
    
    // Create new vehicle in Firestore
    const vehRef = db.collection('users').doc(userId)
      .collection('vehicles')
      .doc();
    
    batch.set(vehRef, vehicle);
    
    // Commit all changes atomically
    await batch.commit();
    
    // Get created vehicle
    const vehDoc = await vehRef.get();
    const createdVehicle = docToVehicle(vehDoc);
    
    // Also save to localStorage for backward compatibility
    if (window.cleartrackData && window.cleartrackData.addVehicle) {
      try {
        window.cleartrackData.addVehicle(userId, createdVehicle);
      } catch (error) {
        console.warn('[vehicle-lifecycle] Failed to sync to localStorage:', error);
      }
    }
    
    return createdVehicle;
  }

  /**
   * Set a vehicle as active (switches from current active vehicle)
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID to activate
   * @returns {Promise<Object>} Updated vehicle
   */
  async function setActiveVehicle(userId, vehicleId) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!vehicleId) {
      throw new Error('vehicleId is required');
    }
    
    // Validate current active vehicle has closingKm set
    await validateActiveVehicleClosed(userId);
    
    // Get the vehicle to activate
    const vehicleDoc = await db.collection('users').doc(userId)
      .collection('vehicles')
      .doc(vehicleId)
      .get();
    
    if (!vehicleDoc.exists) {
      throw new Error('Vehicle not found');
    }
    
    const vehicle = docToVehicle(vehicleDoc);
    
    // Validate vehicle is not already ended
    if (vehicle.endedAt) {
      throw new Error('Cannot activate a vehicle that has already been ended');
    }
    
    // Deactivate all current active vehicles
    const activeVehicles = await db.collection('users').doc(userId)
      .collection('vehicles')
      .where('status', '==', 'active')
      .get();
    
    const batch = db.batch();
    for (const doc of activeVehicles.docs) {
      batch.update(doc.ref, {
        status: 'inactive',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Activate the new vehicle
    batch.update(vehicleDoc.ref, {
      status: 'active',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    
    // Return updated vehicle
    const updatedDoc = await db.collection('users').doc(userId)
      .collection('vehicles')
      .doc(vehicleId)
      .get();
    
    return docToVehicle(updatedDoc);
  }

  /**
   * Close a vehicle (set ending date and closing mileage)
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @param {number} closingKm - Closing odometer reading
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} [taxYear] - Optional tax year context { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
   * @returns {Promise<Object>} Updated vehicle
   */
  async function closeVehicle(userId, vehicleId, closingKm, endDate, taxYear = null) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!vehicleId) {
      throw new Error('vehicleId is required');
    }
    if (closingKm === null || closingKm === undefined) {
      throw new Error('closingKm is required');
    }
    if (!endDate) {
      throw new Error('endDate is required');
    }
    
    // Validate date format
    validateDateFormat(endDate, 'endDate');
    
    // Validate closingKm is a number
    const closingKmNum = Number(closingKm);
    if (isNaN(closingKmNum) || closingKmNum < 0) {
      throw new Error('closingKm must be a non-negative number');
    }
    
    // Get the vehicle
    const vehicleDoc = await db.collection('users').doc(userId)
      .collection('vehicles')
      .doc(vehicleId)
      .get();
    
    if (!vehicleDoc.exists) {
      throw new Error('Vehicle not found');
    }
    
    const vehicle = docToVehicle(vehicleDoc);
    
    // Validate closingKm > openingKm
    if (closingKmNum <= vehicle.openingKm) {
      throw new Error('closingKm must be greater than openingKm');
    }
    
    // Validate endDate >= startedAt
    validateDateOrder(vehicle.startedAt, endDate);
    
    // Validate endDate doesn't exceed taxYear.end or engagement endDate
    await validateVehicleWithinEngagement(userId, vehicle.startedAt, endDate, taxYear);
    
    // Update vehicle
    await db.collection('users').doc(userId)
      .collection('vehicles')
      .doc(vehicleId)
      .update({
        endedAt: endDate,
        closingKm: closingKmNum,
        status: 'inactive',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    // Return updated vehicle
    const updatedDoc = await db.collection('users').doc(userId)
      .collection('vehicles')
      .doc(vehicleId)
      .get();
    
    return docToVehicle(updatedDoc);
  }

  /**
   * Get all vehicles for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} Array of vehicles
   */
  async function getVehiclesForUser(userId) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const snapshot = await db.collection('users').doc(userId)
      .collection('vehicles')
      .orderBy('startedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => docToVehicle(doc));
  }

  /**
   * Get the active vehicle for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Active vehicle or null
   */
  async function getActiveVehicle(userId) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const snapshot = await db.collection('users').doc(userId)
      .collection('vehicles')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return docToVehicle(snapshot.docs[0]);
  }

  /**
   * Assert vehicle readiness for logbook generation
   * Validates that vehicles are properly configured for logbook generation within a tax year.
   * 
   * @param {string} userId - User ID
   * @param {Object} taxYear - Tax year date range
   * @param {string} taxYear.start - Start date (YYYY-MM-DD)
   * @param {string} taxYear.end - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Validation result
   * @returns {boolean} ok - True if vehicles are ready (may have warnings)
   * @returns {string[]} issues - Array of warning/error messages
   * @returns {Array<Object>} vehicleRanges - Array of vehicle date ranges for logbook generation
   * @throws {Error} Only if critical validation fails (no vehicles, invalid data)
   */
  async function assertVehicleReadyForLogbook(userId, taxYear) {
    const { db } = ensureFirebase();
    
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!taxYear || !taxYear.start || !taxYear.end) {
      throw new Error('taxYear must have start and end properties in YYYY-MM-DD format');
    }
    
    // Validate tax year date format
    validateDateFormat(taxYear.start, 'taxYear.start');
    validateDateFormat(taxYear.end, 'taxYear.end');
    
    const taxYearStart = new Date(taxYear.start);
    const taxYearEnd = new Date(taxYear.end);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Get all vehicles for the user
    const vehicles = await getVehiclesForUser(userId);
    
    // Critical: Must have at least 1 vehicle
    if (!vehicles || vehicles.length === 0) {
      throw new Error('User must have at least one vehicle to generate a logbook');
    }
    
    const issues = [];
    const vehicleRanges = [];
    
    // Check each vehicle that intersects the tax year range
    for (const vehicle of vehicles) {
      const vehicleStart = new Date(vehicle.startedAt);
      const vehicleEnd = vehicle.endedAt ? new Date(vehicle.endedAt) : new Date('9999-12-31');
      
      // Check if vehicle intersects with tax year
      const intersects = vehicleStart <= taxYearEnd && vehicleEnd >= taxYearStart;
      
      if (!intersects) {
        continue; // Skip vehicles that don't intersect tax year
      }
      
      // Determine effective date range for this vehicle within tax year
      const effectiveStart = vehicleStart > taxYearStart ? vehicleStart : taxYearStart;
      const effectiveEnd = vehicleEnd < taxYearEnd ? vehicleEnd : taxYearEnd;
      
      // Validate openingKm is a number
      if (vehicle.openingKm === null || vehicle.openingKm === undefined || isNaN(Number(vehicle.openingKm))) {
        issues.push(`Vehicle "${vehicle.regNumber || vehicle.label || 'Unknown'}" has invalid openingKm`);
        continue; // Skip this vehicle
      }
      
      const openingKm = Number(vehicle.openingKm);
      if (openingKm < 0) {
        issues.push(`Vehicle "${vehicle.regNumber || vehicle.label || 'Unknown'}" has negative openingKm`);
        continue;
      }
      
      // If vehicle has endedAt, closingKm must exist and be > openingKm
      if (vehicle.endedAt) {
        if (vehicle.closingKm === null || vehicle.closingKm === undefined) {
          issues.push(`Vehicle "${vehicle.regNumber || vehicle.label || 'Unknown'}" ended on ${vehicle.endedAt} but has no closingKm`);
          continue; // Skip this vehicle - critical issue
        }
        
        const closingKm = Number(vehicle.closingKm);
        if (isNaN(closingKm) || closingKm <= openingKm) {
          issues.push(`Vehicle "${vehicle.regNumber || vehicle.label || 'Unknown'}" has invalid closingKm (must be > openingKm)`);
          continue; // Skip this vehicle - critical issue
        }
      }
      
      // If vehicle is active (no endedAt)
      if (!vehicle.endedAt) {
        // If active vehicle has no closingKm, allow generation but only up to current date
        if (vehicle.closingKm === null || vehicle.closingKm === undefined) {
          // Constrain to current date if it's before tax year end
          const mustStopAtDate = today < effectiveEnd ? formatDate(today) : null;
          
          vehicleRanges.push({
            vehicleId: vehicle.id,
            regNumber: vehicle.regNumber || vehicle.label || 'Unknown',
            startDate: formatDate(effectiveStart),
            endDate: formatDate(effectiveEnd),
            mustStopAtDate: mustStopAtDate
          });
          
          if (mustStopAtDate) {
            issues.push(`Active vehicle "${vehicle.regNumber || vehicle.label || 'Unknown'}" has no closingKm - logbook generation limited to ${mustStopAtDate}`);
          }
        } else {
          // Active vehicle with closingKm - can use full range
          vehicleRanges.push({
            vehicleId: vehicle.id,
            regNumber: vehicle.regNumber || vehicle.label || 'Unknown',
            startDate: formatDate(effectiveStart),
            endDate: formatDate(effectiveEnd)
          });
        }
      } else {
        // Ended vehicle - use full effective range
        vehicleRanges.push({
          vehicleId: vehicle.id,
          regNumber: vehicle.regNumber || vehicle.label || 'Unknown',
          startDate: formatDate(effectiveStart),
          endDate: formatDate(effectiveEnd)
        });
      }
    }
    
    // Critical: Must have at least one valid vehicle range
    if (vehicleRanges.length === 0) {
      throw new Error('No vehicles are valid for logbook generation in the specified tax year. Check vehicle dates and mileage settings.');
    }
    
    // Determine if result is ok (warnings are ok, but critical errors would have thrown)
    const ok = true; // If we got here, vehicles are usable (may have warnings)
    
    return {
      ok: ok,
      issues: issues,
      vehicleRanges: vehicleRanges
    };
  }

  /**
   * Get vehicle date ranges for a tax year, clamped to tax year boundaries
   * Returns vehicles that intersect the tax year with their effective date ranges.
   * 
   * @param {string} userId - User ID
   * @param {Object} taxYear - Tax year date range
   * @param {string} taxYear.start - Start date (YYYY-MM-DD)
   * @param {string} taxYear.end - End date (YYYY-MM-DD)
   * @returns {Promise<Array<Object>>} Array of vehicle date ranges
   * @returns {string} vehicleId - Vehicle ID
   * @returns {string} regNumber - Vehicle registration number
   * @returns {number} openingKm - Opening odometer reading
   * @returns {string} startDate - Effective start date (YYYY-MM-DD, clamped to tax year)
   * @returns {string} endDate - Effective end date (YYYY-MM-DD, clamped to tax year)
   * @returns {number|null} closingKm - Closing odometer reading (null if active)
   */
  async function getVehicleDateRangesForTaxYear(userId, taxYear) {
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!taxYear || !taxYear.start || !taxYear.end) {
      throw new Error('taxYear must have start and end properties in YYYY-MM-DD format');
    }
    
    // Validate tax year date format
    validateDateFormat(taxYear.start, 'taxYear.start');
    validateDateFormat(taxYear.end, 'taxYear.end');
    
    const taxYearStart = new Date(taxYear.start);
    const taxYearEnd = new Date(taxYear.end);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    // Get all vehicles for the user
    const vehicles = await getVehiclesForUser(userId);
    
    if (!vehicles || vehicles.length === 0) {
      return [];
    }
    
    const vehicleRanges = [];
    
    // Process each vehicle that intersects the tax year range
    for (const vehicle of vehicles) {
      const vehicleStart = new Date(vehicle.startedAt);
      const vehicleEnd = vehicle.endedAt ? new Date(vehicle.endedAt) : new Date('9999-12-31');
      
      // Check if vehicle intersects with tax year
      const intersects = vehicleStart <= taxYearEnd && vehicleEnd >= taxYearStart;
      
      if (!intersects) {
        continue; // Skip vehicles that don't intersect tax year
      }
      
      // Clamp startDate to tax year boundaries
      const effectiveStart = vehicleStart > taxYearStart ? vehicleStart : taxYearStart;
      const effectiveStartDate = formatDate(effectiveStart);
      
      // Clamp endDate to tax year boundaries
      // If active vehicle has no endedAt, endDate = min(today, taxYear.end)
      let effectiveEnd;
      if (!vehicle.endedAt) {
        // Active vehicle: use min(today, taxYear.end)
        effectiveEnd = today < taxYearEnd ? today : taxYearEnd;
      } else {
        // Ended vehicle: use min(vehicleEnd, taxYear.end)
        effectiveEnd = vehicleEnd < taxYearEnd ? vehicleEnd : taxYearEnd;
      }
      const effectiveEndDate = formatDate(effectiveEnd);
      
      vehicleRanges.push({
        vehicleId: vehicle.id,
        regNumber: vehicle.regNumber || vehicle.label || 'Unknown',
        openingKm: vehicle.openingKm !== undefined ? Number(vehicle.openingKm) : 0,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        closingKm: vehicle.closingKm !== undefined && vehicle.closingKm !== null ? Number(vehicle.closingKm) : null
      });
    }
    
    // Sort by startDate ascending
    vehicleRanges.sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);
      return dateA - dateB;
    });
    
    return vehicleRanges;
  }

  /**
   * CT-PHASE3-MULTI-VEHICLE-SARS: Assign trip/expense to vehicle based on date
   * Returns the vehicle ID that should be assigned to a trip on a given date
   * @param {string} userId - User ID
   * @param {string} tripDate - Trip date (YYYY-MM-DD)
   * @returns {Promise<string|null>} Vehicle ID or null if no active vehicle on that date
   */
  async function assignTripToVehicle(userId, tripDate) {
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!tripDate) {
      throw new Error('tripDate is required');
    }
    
    validateDateFormat(tripDate, 'tripDate');
    
    const vehicles = await getVehiclesForUser(userId);
    if (!vehicles || vehicles.length === 0) {
      return null;
    }
    
    const tripDateObj = new Date(tripDate);
    
    // Find vehicle active on trip date
    for (const vehicle of vehicles) {
      const vehicleStart = new Date(vehicle.startedAt);
      const vehicleEnd = vehicle.endedAt ? new Date(vehicle.endedAt) : new Date('9999-12-31');
      
      // Check if trip date falls within vehicle's active period
      if (tripDateObj >= vehicleStart && tripDateObj <= vehicleEnd) {
        return vehicle.id;
      }
    }
    
    // No vehicle found for this date
    return null;
  }

  /**
   * CT-PHASE3-MULTI-VEHICLE-SARS: Validate trip can be created (employment end check)
   * Prevents trip creation after employment end date
   * @param {string} userId - User ID
   * @param {string} tripDate - Trip date (YYYY-MM-DD)
   * @param {Object} [taxYear] - Optional tax year context
   * @throws {Error} If trip date is after employment end date
   */
  async function validateTripDateAgainstEmployment(userId, tripDate, taxYear = null) {
    if (!window.engagementService || !window.engagementService.getEffectiveLogbookDateRange) {
      // If engagement service not available, skip validation
      return;
    }
    
    validateDateFormat(tripDate, 'tripDate');
    
    const tripDateObj = new Date(tripDate);
    
    // Get effective engagement ranges
    let engagementRanges = [];
    if (taxYear) {
      engagementRanges = await window.engagementService.getEffectiveLogbookDateRange(userId, taxYear);
    } else {
      const allEngagements = await window.engagementService.getEngagementPeriodsForUser(userId);
      if (allEngagements && allEngagements.length > 0) {
        engagementRanges = allEngagements.map(eng => ({
          engagementId: eng.id,
          role: eng.role,
          startDate: eng.startDate,
          endDate: eng.endDate || null
        }));
      }
    }
    
    // If no engagement periods, allow trip (user may not have engagements yet)
    if (!engagementRanges || engagementRanges.length === 0) {
      return;
    }
    
    // Check if trip date falls within any engagement period
    let isValid = false;
    let latestEndDate = null;
    
    for (const range of engagementRanges) {
      const engagementStart = new Date(range.startDate);
      const engagementEnd = range.endDate ? new Date(range.endDate) : new Date('9999-12-31');
      
      if (tripDateObj >= engagementStart && tripDateObj <= engagementEnd) {
        isValid = true;
        break;
      }
      
      // Track latest end date for error message
      if (range.endDate && (!latestEndDate || new Date(range.endDate) > latestEndDate)) {
        latestEndDate = new Date(range.endDate);
      }
    }
    
    if (!isValid) {
      const endDateStr = latestEndDate ? formatDate(latestEndDate) : 'employment end date';
      throw new Error(`Trip date ${tripDate} is after employment end date (${endDateStr}). Trips cannot be created after employment ends.`);
    }
  }

  /**
   * CT-PHASE3-MULTI-VEHICLE-SARS: Prepare SARS export data structure
   * Organizes logbook data by vehicle and usage period for SARS compliance
   * @param {string} userId - User ID
   * @param {Object} taxYear - Tax year date range
   * @param {string} taxYear.start - Start date (YYYY-MM-DD)
   * @param {string} taxYear.end - End date (YYYY-MM-DD)
   * @param {Array} trips - Array of trip/expense objects with date and vehicleId
   * @returns {Promise<Object>} SARS-ready data structure
   */
  async function prepareSARSExportData(userId, taxYear, trips = []) {
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!taxYear || !taxYear.start || !taxYear.end) {
      throw new Error('taxYear must have start and end properties in YYYY-MM-DD format');
    }
    
    validateDateFormat(taxYear.start, 'taxYear.start');
    validateDateFormat(taxYear.end, 'taxYear.end');
    
    // Get vehicle date ranges for tax year
    const vehicleRanges = await getVehicleDateRangesForTaxYear(userId, taxYear);
    
    if (!vehicleRanges || vehicleRanges.length === 0) {
      return {
        taxYear: taxYear,
        vehicles: [],
        totals: {
          totalTrips: 0,
          totalDistance: 0,
          totalBusinessDistance: 0
        }
      };
    }
    
    // Organize trips by vehicle
    const tripsByVehicle = {};
    for (const trip of trips) {
      const vehicleId = trip.vehicleId || null;
      if (!vehicleId) continue;
      
      if (!tripsByVehicle[vehicleId]) {
        tripsByVehicle[vehicleId] = [];
      }
      tripsByVehicle[vehicleId].push(trip);
    }
    
    // Build SARS export structure
    const sarsData = {
      taxYear: taxYear,
      vehicles: [],
      totals: {
        totalTrips: 0,
        totalDistance: 0,
        totalBusinessDistance: 0
      }
    };
    
    // Process each vehicle
    for (const vehicleRange of vehicleRanges) {
      const vehicleTrips = tripsByVehicle[vehicleRange.vehicleId] || [];
      
      // Filter trips within vehicle's date range
      const vehicleStart = new Date(vehicleRange.startDate);
      const vehicleEnd = new Date(vehicleRange.endDate);
      const validTrips = vehicleTrips.filter(trip => {
        const tripDate = new Date(trip.date);
        return tripDate >= vehicleStart && tripDate <= vehicleEnd;
      });
      
      // Calculate vehicle totals
      const vehicleDistance = validTrips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
      const vehicleBusinessDistance = validTrips.reduce((sum, trip) => {
        const businessUse = trip.businessUse || 100;
        return sum + ((trip.distance || 0) * (businessUse / 100));
      }, 0);
      
      sarsData.vehicles.push({
        vehicleId: vehicleRange.vehicleId,
        regNumber: vehicleRange.regNumber,
        startDate: vehicleRange.startDate,
        endDate: vehicleRange.endDate,
        openingKm: vehicleRange.openingKm,
        closingKm: vehicleRange.closingKm,
        trips: validTrips,
        totals: {
          tripCount: validTrips.length,
          totalDistance: vehicleDistance,
          businessDistance: vehicleBusinessDistance
        }
      });
      
      // Update aggregate totals
      sarsData.totals.totalTrips += validTrips.length;
      sarsData.totals.totalDistance += vehicleDistance;
      sarsData.totals.totalBusinessDistance += vehicleBusinessDistance;
    }
    
    return sarsData;
  }

  // Export service object
  const vehicleLifecycleService = {
    addVehicle,
    setActiveVehicle,
    closeVehicle,
    getVehiclesForUser,
    getActiveVehicle,
    assertVehicleReadyForLogbook,
    getVehicleDateRangesForTaxYear,
    assignTripToVehicle,
    validateTripDateAgainstEmployment,
    prepareSARSExportData
  };

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = vehicleLifecycleService;
  }

  // Export globally
  if (typeof window !== 'undefined') {
    window.vehicleLifecycleService = vehicleLifecycleService;
  }

})();

