/**
 * Firestore Data Manager for ClearTrack
 * 
 * This extends the localStorage-based system with Firestore support.
 * During migration, it uses Firestore as primary with localStorage fallback.
 */

// FirestoreDataManager class definition
class FirestoreDataManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.migrationComplete = false;
        this.migrationAttempted = false; // Track if migration was attempted this session
        this.listeners = {}; // Store real-time listeners
        // Persistent warning tracking across page reloads within session
        // Uses sessionStorage to persist across page reloads
        this._warningLogKey = 'firestore_warning_log';
        this._initWarningLog();
        this.init();
    }
    
    // Initialize warning log from sessionStorage
    _initWarningLog() {
        try {
            const stored = sessionStorage.getItem(this._warningLogKey);
            this._warningLog = stored ? new Set(JSON.parse(stored)) : new Set();
        } catch (error) {
            console.warn('[firestore-data] Error loading warning log from sessionStorage:', error);
            this._warningLog = new Set();
        }
    }
    
    // Save warning log to sessionStorage
    _saveWarningLog() {
        try {
            sessionStorage.setItem(this._warningLogKey, JSON.stringify(Array.from(this._warningLog)));
        } catch (error) {
            // sessionStorage might be full or unavailable, continue silently
        }
    }

    init() {
        // Priority 1: Use window.firebaseDb and window.firebaseAuth if available (set by firebase-init.js)
        if (window.firebaseDb && window.firebaseAuth) {
            this.db = window.firebaseDb;
            this.auth = window.firebaseAuth;
            this.checkMigrationStatus();
            return;
        }

        // Priority 2: Initialize from firebase SDK directly
        if (typeof firebase !== 'undefined' && firebase.firestore && firebase.auth) {
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            this.checkMigrationStatus();
        } else {
            // Wait for Firebase to be available
            const checkFirebase = setInterval(() => {
                // Check window.firebaseDb first (set by firebase-init.js)
                if (window.firebaseDb && window.firebaseAuth) {
                    clearInterval(checkFirebase);
                    this.db = window.firebaseDb;
                    this.auth = window.firebaseAuth;
                    this.checkMigrationStatus();
                } else if (typeof firebase !== 'undefined' && firebase.firestore && firebase.auth) {
                    clearInterval(checkFirebase);
                    this.db = firebase.firestore();
                    this.auth = firebase.auth();
                    this.checkMigrationStatus();
                }
            }, 100);
            
            setTimeout(() => clearInterval(checkFirebase), 10000);
        }
    }

    async checkMigrationStatus() {
        if (!this.auth || !this.auth.currentUser) return;
        
        try {
            const userDoc = await this.db.collection('users').doc(this.auth.currentUser.uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                this.migrationComplete = data.migrationComplete || false;
            }
        } catch (error) {
            console.warn('Could not check migration status:', error);
        }
    }

    // Helper to get current user ID
    getCurrentUserId() {
        if (!this.auth || !this.auth.currentUser) return null;
        return this.auth.currentUser.uid;
    }

    // Helper to check if user is authenticated
    isAuthenticated() {
        return this.auth && this.auth.currentUser !== null;
    }

    // ========== CONNECTIONS ==========
    
    async connectUserToPractitioner(userId, practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            // Fallback to localStorage
            return window.cleartrackData.connectUserToPractitioner(userId, practitionerId);
        }

        try {
            const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            
            // Update user document with complete connection information
            await this.db.collection('users').doc(userId).update({
                connectedPractitioner: practitionerId,
                currentPractitionerId: practitionerId,
                practitionerId: practitionerId, // Legacy field
                connectionStatus: 'approved',
                connectionResolved: true,
                practitionerStatus: 'approved',
                practitionerRejectionCount: 0,
                approvedAt: serverTimestamp,
                updatedAt: serverTimestamp
            });

            // Create connection document
            const connectionData = {
                userId: userId,
                practitionerId: practitionerId,
                connectedAt: serverTimestamp,
                status: 'active'
            };

            await this.db.collection('connections').add(connectionData);

            // Also update localStorage for backward compatibility
            window.cleartrackData.connectUserToPractitioner(userId, practitionerId);

            console.log('[firestore-data] User connected to practitioner:', { userId, practitionerId });
            return true;
        } catch (error) {
            console.error('Error connecting user to practitioner in Firestore:', error);
            // Fallback to localStorage
            return window.cleartrackData.connectUserToPractitioner(userId, practitionerId);
        }
    }

    async isUserConnectedToPractitioner(userId, practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.isUserConnectedToPractitioner(userId, practitionerId);
        }

        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return userData.connectedPractitioner === practitionerId;
            }
            return false;
        } catch (error) {
            console.error('Error checking connection in Firestore:', error);
            return window.cleartrackData.isUserConnectedToPractitioner(userId, practitionerId);
        }
    }

    async disconnectUserFromPractitioner(userId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.disconnectUserFromPractitioner(userId);
        }

        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const practitionerId = userData.connectedPractitioner;

                // Update user document
                await this.db.collection('users').doc(userId).update({
                    connectedPractitioner: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update connection status
                const connectionsSnapshot = await this.db.collection('connections')
                    .where('userId', '==', userId)
                    .where('practitionerId', '==', practitionerId)
                    .where('status', '==', 'active')
                    .get();

                const batch = this.db.batch();
                connectionsSnapshot.forEach(doc => {
                    batch.update(doc.ref, {
                        status: 'disconnected',
                        disconnectedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                await batch.commit();

                // Also update localStorage
                window.cleartrackData.disconnectUserFromPractitioner(userId);

                return true;
            }
            return false;
        } catch (error) {
            console.error('Error disconnecting in Firestore:', error);
            return window.cleartrackData.disconnectUserFromPractitioner(userId);
        }
    }

    async getConnectedUsers(practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getConnectedUsers(practitionerId);
        }

        try {
            // CRITICAL: Role guard - only practitioners (and admins) can query connected users
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                console.warn('[firestore-data] No authenticated user, falling back to localStorage');
                return window.cleartrackData.getConnectedUsers(practitionerId);
            }

            // Check user role before attempting Firestore query
            const userDoc = await this.db.collection('users').doc(currentUser.uid).get();
            if (!userDoc.exists) {
                console.warn('[firestore-data] User document not found, falling back to localStorage');
                return window.cleartrackData.getConnectedUsers(practitionerId);
            }

            const userData = userDoc.data();
            const userRole = (userData.role || '').toLowerCase().trim();
            
            // Only allow practitioners and admins to query connected users
            if (userRole !== 'practitioner' && userRole !== 'admin') {
                console.warn('[firestore-data] User is not a practitioner or admin, falling back to localStorage');
                return window.cleartrackData.getConnectedUsers(practitionerId);
            }

            // Ensure practitionerId matches authenticated user for security
            // This prevents practitioners from querying other practitioners' connections
            if (currentUser.uid !== practitionerId) {
                console.warn('[firestore-data] Practitioner ID mismatch, falling back to localStorage');
                return window.cleartrackData.getConnectedUsers(practitionerId);
            }

            // Query connections collection first (has proper security rules for practitioners)
            // Use request.auth.uid to ensure security rules allow the query
            // Note: Only query by practitionerId, filter status in code to avoid rule evaluation issues
            let connectionsSnapshot;
            try {
                connectionsSnapshot = await this.db.collection('connections')
                    .where('practitionerId', '==', currentUser.uid)
                    .get();
            } catch (queryError) {
                // If query fails due to permissions, try without where clause and filter in code
                if (queryError.code === 'permission-denied') {
                    console.warn('[firestore-data] Query permission denied, trying alternative approach');
                    // Fallback: Get all connections and filter in code (less efficient but should work)
                    const allConnections = await this.db.collection('connections').get();
                    connectionsSnapshot = {
                        docs: allConnections.docs.filter(doc => {
                            const data = doc.data();
                            return data.practitionerId === currentUser.uid && data.status === 'active';
                        })
                    };
                } else {
                    throw queryError;
                }
            }

            const connectedUsers = [];
            const seenUserIds = new Set(); // Track users we've already added
            
            // Fetch user documents individually for each connection
            // Filter for active connections only
            for (const connectionDoc of connectionsSnapshot.docs) {
                const connectionData = connectionDoc.data();
                
                // Filter for active connections only (done in code to avoid rule issues)
                if (connectionData.status !== 'active') continue;
                
                const userId = connectionData.userId;
                if (!userId) continue;
                
                // CRITICAL: Skip if we've already processed this user (deduplication)
                if (seenUserIds.has(userId)) {
                    // Only log duplicate warning once per userId per session (persists across page reloads)
                    const duplicateKey = `duplicate_${userId}`;
                    if (!this._warningLog.has(duplicateKey)) {
                        console.warn(`[firestore-data] Duplicate connection found for user ${userId}, skipping`);
                        this._warningLog.add(duplicateKey);
                        this._saveWarningLog(); // Persist to sessionStorage
                    }
                    continue;
                }
                
                try {
                    // Fetch user document (rules allow isSignedIn() to read user documents)
                    const userDoc = await this.db.collection('users').doc(userId).get();
                    
                    if (!userDoc.exists) continue;
                    
                    const userData = userDoc.data();
                    
                    // CRITICAL: Check if currentPractitionerId matches before reading subcollections
                    // Firestore rules require currentPractitionerId == request.auth.uid for subcollection access
                    const canReadSubcollections = userData.currentPractitionerId === currentUser.uid;
                    
                    let documentCount = 0;
                    let expenseCount = 0;
                    let totalExpenses = 0;
                    let documents = [];
                    let expenses = [];
                    
                    // Only try to read subcollections if currentPractitionerId matches
                    if (canReadSubcollections) {
                        try {
                            // Get documents count
                            const documentsSnapshot = await this.db.collection('users')
                                .doc(userId)
                                .collection('documents')
                                .get();
                            documentCount = documentsSnapshot.size;
                            documents = documentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        } catch (docError) {
                            // Permission denied or other error - log but continue
                            if (docError.code === 'permission-denied') {
                                // Only log once per userId per session (persists across page reloads)
                                const docWarnKey = `doc_permission_${userId}`;
                                if (!this._warningLog.has(docWarnKey)) {
                                    console.warn(`[firestore-data] Permission denied reading documents for user ${userId} - currentPractitionerId mismatch`);
                                    this._warningLog.add(docWarnKey);
                                    this._saveWarningLog(); // Persist to sessionStorage
                                }
                            } else {
                                console.warn(`[firestore-data] Error reading documents for user ${userId}:`, docError);
                            }
                            // Continue with documentCount = 0
                        }
                        
                        try {
                            // Get expenses
                            const expensesSnapshot = await this.db.collection('users')
                                .doc(userId)
                                .collection('expenses')
                                .get();
                            expenseCount = expensesSnapshot.size;
                            expenses = expensesSnapshot.docs.map(doc => doc.data());
                            totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
                        } catch (expenseError) {
                            // Permission denied or other error - log but continue
                            if (expenseError.code === 'permission-denied') {
                                // Only log once per userId per session (persists across page reloads)
                                const expWarnKey = `exp_permission_${userId}`;
                                if (!this._warningLog.has(expWarnKey)) {
                                    console.warn(`[firestore-data] Permission denied reading expenses for user ${userId} - currentPractitionerId mismatch`);
                                    this._warningLog.add(expWarnKey);
                                    this._saveWarningLog(); // Persist to sessionStorage
                                }
                            } else {
                                console.warn(`[firestore-data] Error reading expenses for user ${userId}:`, expenseError);
                            }
                            // Continue with expenseCount = 0, totalExpenses = 0
                        }
                    } else {
                        // currentPractitionerId doesn't match - log warning but still include user in list
                        // Only log once per userId per session (persists across page reloads)
                        const mismatchKey = `mismatch_${userId}`;
                        if (!this._warningLog.has(mismatchKey)) {
                            console.warn(`[firestore-data] User ${userId} has currentPractitionerId=${userData.currentPractitionerId}, expected ${currentUser.uid}. Skipping subcollections.`);
                            this._warningLog.add(mismatchKey);
                            this._saveWarningLog(); // Persist to sessionStorage
                        }
                    }
                    
                    // Format user data to match expected structure
                    connectedUsers.push({
                        id: userId,
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || '',
                        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown',
                        email: userData.email || '',
                        phone: userData.phone || userData.mobile || '',
                        mobile: userData.mobile || userData.phone || '',
                        connectedPractitioner: practitionerId,
                        connectedAt: connectionData.connectedAt ? (connectionData.connectedAt.toDate ? connectionData.connectedAt.toDate().toISOString() : connectionData.connectedAt) : new Date().toISOString(),
                        documentCount: documentCount,
                        expenseCount: expenseCount,
                        totalExpenses: totalExpenses,
                        isActive: documentCount > 0 || expenseCount > 0,
                        documents: documents,
                        expenses: expenses,
                        vehicles: [] // Will be populated if needed
                    });
                    
                    // Mark this user as processed
                    seenUserIds.add(userId);
                } catch (userError) {
                    // If user document read fails, log and continue with next user
                    console.warn(`[firestore-data] Error processing user ${userId}:`, userError);
                    continue;
                }
            }
            
            return connectedUsers;
        } catch (error) {
            console.error('Error getting connected users from Firestore:', error);
            // Fallback to localStorage
            return window.cleartrackData.getConnectedUsers(practitionerId);
        }
    }

    // ========== CONNECTION REQUESTS ==========

    async sendConnectionRequest(userId, practitionerId, clientRequestId = null) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.sendConnectionRequest(userId, practitionerId);
        }

        try {
            // CRITICAL: Prevent self-requests (user cannot request connection to themselves)
            if (userId === practitionerId) {
                console.warn('[firestore-data] Blocked self-request:', { userId, practitionerId });
                return { success: false, error: 'You cannot request a connection to yourself' };
            }
            
            // Validate clientRequestId if provided
            if (clientRequestId) {
                const clientRequestDoc = await this.db.collection('clientRequests').doc(clientRequestId).get();
                if (!clientRequestDoc.exists) {
                    console.warn('[firestore-data] clientRequestId provided but document not found:', clientRequestId);
                    // Continue anyway - don't block creation
                }
            }
            
            // Check if already connected
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.connectedPractitioner === practitionerId) {
                    return { success: false, error: 'User already connected to this practitioner' };
                }
            }

            // Check for existing pending request
            const existingRequests = await this.db.collection('connectionRequests')
                .where('userId', '==', userId)
                .where('practitionerId', '==', practitionerId)
                .where('status', '==', 'pending')
                .get();

            if (!existingRequests.empty) {
                const existingRequest = existingRequests.docs[0].data();
                return { success: true, request: existingRequest, message: 'Request already exists' };
            }

            // Create new request
            const requestData = {
                userId: userId,
                practitionerId: practitionerId,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add clientRequestId if provided
            if (clientRequestId) {
                requestData.clientRequestId = clientRequestId;
            }

            const requestRef = await this.db.collection('connectionRequests').add(requestData);
            const requestDoc = await requestRef.get();
            const request = { id: requestRef.id, ...requestDoc.data() };

            console.log('[firestore-data] Connection request created successfully:', {
                requestId: requestRef.id,
                userId: userId,
                practitionerId: practitionerId
            });

            // Also save to localStorage for backward compatibility
            window.cleartrackData.sendConnectionRequest(userId, practitionerId);

            return { success: true, request: request };
        } catch (error) {
            console.error('Error sending connection request in Firestore:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                userId: userId,
                practitionerId: practitionerId
            });
            // Return error instead of falling back to localStorage
            // This ensures the UI knows Firestore write failed
            return { 
                success: false, 
                error: error.message || 'Failed to create connection request in Firestore',
                firestoreError: true
            };
        }
    }

    async getConnectionRequests(practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getConnectionRequests(practitionerId);
        }

        try {
            // Try with orderBy first, fallback to without if index missing
            let snapshot;
            try {
                snapshot = await this.db.collection('connectionRequests')
                    .where('practitionerId', '==', practitionerId)
                    .where('status', '==', 'pending')
                    .orderBy('timestamp', 'desc')
                    .get();
            } catch (indexError) {
                // If index missing, get without orderBy and sort in memory
                if (indexError.code === 'failed-precondition') {
                    console.warn('[firestore-data] Firestore index missing for connectionRequests - loading without orderBy');
                    snapshot = await this.db.collection('connectionRequests')
                        .where('practitionerId', '==', practitionerId)
                        .where('status', '==', 'pending')
                        .get();
                    // Sort in memory by timestamp desc
                    snapshot.docs.sort((a, b) => {
                        const aTime = a.data().timestamp?.toMillis?.() || a.data().timestamp?.seconds * 1000 || 0;
                        const bTime = b.data().timestamp?.toMillis?.() || b.data().timestamp?.seconds * 1000 || 0;
                        return bTime - aTime; // desc
                    });
                } else {
                    throw indexError;
                }
            }

            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('[firestore-data] Found', requests.length, 'connection requests for practitioner:', practitionerId);
            return requests;
        } catch (error) {
            console.error('[firestore-data] Error getting connection requests from Firestore:', error);
            console.error('[firestore-data] Error details:', {
                code: error.code,
                message: error.message,
                practitionerId: practitionerId
            });
            return window.cleartrackData.getConnectionRequests(practitionerId);
        }
    }

    async updateConnectionRequest(requestId, status) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.updateConnectionRequest(requestId, status);
        }

        try {
            await this.db.collection('connectionRequests').doc(requestId).update({
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const requestDoc = await this.db.collection('connectionRequests').doc(requestId).get();
            const request = { id: requestDoc.id, ...requestDoc.data() };

            // Also update localStorage
            window.cleartrackData.updateConnectionRequest(requestId, status);

            return request;
        } catch (error) {
            console.error('Error updating connection request in Firestore:', error);
            return window.cleartrackData.updateConnectionRequest(requestId, status);
        }
    }

    // Real-time listener for connection requests
    onConnectionRequests(practitionerId, callback) {
        if (!this.isAuthenticated() || !this.db) return () => {};

        const listenerKey = `connectionRequests_${practitionerId}`;
        
        // Remove existing listener if any
        if (this.listeners[listenerKey]) {
            this.listeners[listenerKey]();
        }

        const unsubscribe = this.db.collection('connectionRequests')
            .where('practitionerId', '==', practitionerId)
            .where('status', '==', 'pending')
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(requests);
            }, (error) => {
                console.error('Error in connection requests listener:', error);
            });

        this.listeners[listenerKey] = unsubscribe;
        return unsubscribe;
    }

    // ========== DOCUMENTS ==========

    async addDocument(userId, documentData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.addDocument(userId, documentData);
        }

        try {
            const docData = {
                ...documentData,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection('users').doc(userId)
                .collection('documents').add(docData);
            
            const doc = await docRef.get();
            const document = { id: docRef.id, ...doc.data() };

            // Also save to localStorage
            window.cleartrackData.addDocument(userId, document);

            return document;
        } catch (error) {
            console.error('Error adding document to Firestore:', error);
            return window.cleartrackData.addDocument(userId, documentData);
        }
    }

    async getUserDocuments(userId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getUserDocuments(userId);
        }

        try {
            const snapshot = await this.db.collection('users').doc(userId)
                .collection('documents')
                .orderBy('uploadedAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting documents from Firestore:', error);
            return window.cleartrackData.getUserDocuments(userId);
        }
    }

    async deleteDocument(userId, documentId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.deleteDocument(userId, documentId);
        }

        try {
            await this.db.collection('users').doc(userId)
                .collection('documents').doc(documentId).delete();

            // Also delete from localStorage
            window.cleartrackData.deleteDocument(userId, documentId);

            return true;
        } catch (error) {
            console.error('Error deleting document from Firestore:', error);
            return window.cleartrackData.deleteDocument(userId, documentId);
        }
    }

    // ========== LOGBOOKS ==========

    async addLogbook(userId, logbookData) {
        if (!this.isAuthenticated() || !this.db) {
            console.warn('Firestore not available, logbook cannot be saved');
            return null;
        }

        try {
            const logbookDoc = {
                ...logbookData,
                // NEW: Add metadata fields for editing control
                generationMethod: logbookData.generationMethod || 'route_list',
                lockedForSARS: logbookData.lockedForSARS !== undefined ? logbookData.lockedForSARS : false,
                lastReviewedByPractitioner: logbookData.lastReviewedByPractitioner || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.db.collection('users').doc(userId)
                .collection('logbooks').add(logbookDoc);
            
            const doc = await docRef.get();
            const logbook = { id: docRef.id, ...doc.data() };

            console.log('[firestore-data] Logbook saved:', docRef.id);
            return logbook;
        } catch (error) {
            console.error('Error adding logbook to Firestore:', error);
            throw error;
        }
    }

    async getUserLogbooks(userId, taxYear = null) {
        if (!this.isAuthenticated() || !this.db) {
            console.warn('Firestore not available, cannot retrieve logbooks');
            return [];
        }

        try {
            let query = this.db.collection('users').doc(userId)
                .collection('logbooks')
                .orderBy('createdAt', 'desc');

            // If tax year provided, filter by tax year
            if (taxYear && taxYear.start && taxYear.end) {
                query = query.where('taxYear.start', '==', taxYear.start)
                            .where('taxYear.end', '==', taxYear.end);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting logbooks from Firestore:', error);
            return [];
        }
    }

    async updateLogbook(userId, logbookId, updates) {
        if (!this.isAuthenticated() || !this.db) {
            console.warn('Firestore not available, logbook cannot be updated');
            return null;
        }
        try {
            const updateData = {
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await this.db.collection('users').doc(userId)
                .collection('logbooks').doc(logbookId).update(updateData);
            console.log('[firestore-data] Logbook updated:', logbookId);
            return true;
        } catch (error) {
            console.error('Error updating logbook in Firestore:', error);
            throw error;
        }
    }

    async updateLogbookEntries(userId, logbookId, entryUpdates) {
        // entryUpdates: { index: number, updates: { businessKm?, privateKm?, purpose?, ... } }[]
        if (!this.isAuthenticated() || !this.db) {
            console.warn('Firestore not available, logbook entries cannot be updated');
            return null;
        }
        try {
            const logbookRef = this.db.collection('users').doc(userId)
                .collection('logbooks').doc(logbookId);
            const logbookDoc = await logbookRef.get();
            if (!logbookDoc.exists) {
                throw new Error('Logbook not found');
            }
            const logbook = logbookDoc.data();
            const entries = logbook.logbookEntries || [];
            
            // Apply updates
            entryUpdates.forEach(({ index, updates }) => {
                if (entries[index]) {
                    Object.assign(entries[index], updates);
                }
            });
            
            // Remove entries if marked for deletion
            const filteredEntries = entries.filter((entry, idx) => 
                !entryUpdates.some(u => u.index === idx && u.delete === true)
            );
            
            await logbookRef.update({
                logbookEntries: filteredEntries,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[firestore-data] Logbook entries updated:', logbookId);
            return true;
        } catch (error) {
            console.error('Error updating logbook entries in Firestore:', error);
            throw error;
        }
    }

    async syncLogbookEditsToExpenses(userId, logbookId, entryUpdates) {
        // For each edited entry, find/create corresponding expense and update
        if (!this.isAuthenticated() || !this.db) {
            console.warn('Firestore not available, cannot sync to expenses');
            return null;
        }
        try {
            const logbookRef = this.db.collection('users').doc(userId)
                .collection('logbooks').doc(logbookId);
            const logbookDoc = await logbookRef.get();
            if (!logbookDoc.exists) return;
            
            const logbook = logbookDoc.data();
            const entries = logbook.logbookEntries || [];
            
            for (const { index, updates } of entryUpdates) {
                const entry = entries[index];
                if (!entry) continue;
                
                // Find expense by date and vehicleId
                const expensesQuery = this.db.collection('users').doc(userId)
                    .collection('expenses')
                    .where('date', '==', entry.date)
                    .where('vehicleId', '==', logbook.vehicleId);
                const expensesSnapshot = await expensesQuery.get();
                
                if (!expensesSnapshot.empty) {
                    const expenseDoc = expensesSnapshot.docs[0];
                    const expenseData = expenseDoc.data();
                    const totalKm = (updates.businessKm !== undefined ? updates.businessKm : entry.businessKm || 0) + 
                                  (updates.privateKm !== undefined ? updates.privateKm : entry.privateKm || 0);
                    const businessUse = totalKm > 0 ? 
                        ((updates.businessKm !== undefined ? updates.businessKm : entry.businessKm || 0) / totalKm * 100) : 
                        (expenseData.businessUse || 100);
                    
                    await expenseDoc.ref.update({
                        distance: totalKm,
                        businessUse: businessUse,
                        description: updates.purpose !== undefined ? updates.purpose : (entry.purpose || expenseData.description)
                    });
                }
            }
            console.log('[firestore-data] Logbook edits synced to expenses');
            return true;
        } catch (error) {
            console.error('Error syncing logbook edits to expenses:', error);
            throw error;
        }
    }

    // ========== VEHICLES ==========

    async addVehicle(userId, vehicleData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.addVehicle(userId, vehicleData);
        }

        try {
            const vehData = {
                ...vehicleData,
                vehicleStatus: vehicleData.vehicleStatus || 'active', // Default to active if not specified
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const vehRef = await this.db.collection('users').doc(userId)
                .collection('vehicles').add(vehData);
            
            const veh = await vehRef.get();
            const vehicle = { id: vehRef.id, ...veh.data() };

            // Also save to localStorage
            window.cleartrackData.addVehicle(userId, vehicle);

            return vehicle;
        } catch (error) {
            console.error('Error adding vehicle to Firestore:', error);
            return window.cleartrackData.addVehicle(userId, vehicleData);
        }
    }

    async getUserVehicles(userId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getUserVehicles(userId);
        }

        try {
            const snapshot = await this.db.collection('users').doc(userId)
                .collection('vehicles')
                .orderBy('addedAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting vehicles from Firestore:', error);
            return window.cleartrackData.getUserVehicles(userId);
        }
    }

    // ========== EXPENSES ==========

    async addExpense(userId, expenseData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.addExpense(userId, expenseData);
        }

        try {
            // CT-PHASE3-MULTI-VEHICLE-SARS: Assign vehicle to travel expenses based on date
            // Only assign vehicle if expense is travel-related and has a date
            if (expenseData.category === 'TRAVEL' && expenseData.date && !expenseData.vehicleId) {
                try {
                    if (window.vehicleLifecycleService && typeof window.vehicleLifecycleService.assignTripToVehicle === 'function') {
                        // Validate trip date against employment end date
                        await window.vehicleLifecycleService.validateTripDateAgainstEmployment(userId, expenseData.date);
                        
                        // Assign vehicle based on trip date
                        const vehicleId = await window.vehicleLifecycleService.assignTripToVehicle(userId, expenseData.date);
                        if (vehicleId) {
                            expenseData.vehicleId = vehicleId;
                        } else {
                            // No active vehicle on this date - warn but allow (historical trips may not have vehicles)
                            console.warn(`[expense-service] No active vehicle found for trip date ${expenseData.date}`);
                        }
                    }
                } catch (error) {
                    // If vehicle assignment fails, throw error (employment end validation)
                    if (error.message && error.message.includes('employment end date')) {
                        throw error;
                    }
                    // Other vehicle assignment errors are warnings only
                    console.warn('[expense-service] Vehicle assignment failed:', error.message);
                }
            }

            const expData = {
                ...expenseData,
                recordedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const expRef = await this.db.collection('users').doc(userId)
                .collection('expenses').add(expData);
            
            const exp = await expRef.get();
            const expense = { id: expRef.id, ...exp.data() };

            // Also save to localStorage
            window.cleartrackData.addExpense(userId, expense);

            return expense;
        } catch (error) {
            console.error('Error adding expense to Firestore:', error);
            return window.cleartrackData.addExpense(userId, expenseData);
        }
    }

    async getUserExpenses(userId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getUserExpenses(userId);
        }

        try {
            const snapshot = await this.db.collection('users').doc(userId)
                .collection('expenses')
                .orderBy('recordedAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting expenses from Firestore:', error);
            return window.cleartrackData.getUserExpenses(userId);
        }
    }

    // ========== TAX RETURNS ==========

    async createTaxReturn(practitionerId, userId, taxReturnData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.createTaxReturn(practitionerId, userId, taxReturnData);
        }

        try {
            const trData = {
                practitionerId: practitionerId,
                userId: userId,
                ...taxReturnData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            };

            const trRef = await this.db.collection('taxReturns').add(trData);
            const tr = await trRef.get();
            const taxReturn = { id: trRef.id, ...tr.data() };

            // Also save to localStorage
            window.cleartrackData.createTaxReturn(practitionerId, userId, taxReturn);

            return taxReturn;
        } catch (error) {
            console.error('Error creating tax return in Firestore:', error);
            return window.cleartrackData.createTaxReturn(practitionerId, userId, taxReturnData);
        }
    }

    async getTaxReturnsForPractitioner(practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getTaxReturnsForPractitioner(practitionerId);
        }

        try {
            const snapshot = await this.db.collection('taxReturns')
                .where('practitionerId', '==', practitionerId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting tax returns from Firestore:', error);
            return window.cleartrackData.getTaxReturnsForPractitioner(practitionerId);
        }
    }

    async updateTaxReturnStatus(returnId, newStatus) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.updateTaxReturnStatus(returnId, newStatus);
        }

        try {
            const updateData = {
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (newStatus === 'completed') {
                updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            await this.db.collection('taxReturns').doc(returnId).update(updateData);

            // Also update localStorage
            window.cleartrackData.updateTaxReturnStatus(returnId, newStatus);

            return true;
        } catch (error) {
            console.error('Error updating tax return in Firestore:', error);
            return window.cleartrackData.updateTaxReturnStatus(returnId, newStatus);
        }
    }

    // ========== INVOICES ==========

    async addInvoice(invoiceData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.addInvoice(invoiceData);
        }

        try {
            const invData = {
                ...invoiceData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const invRef = await this.db.collection('invoices').add(invData);
            const inv = await invRef.get();
            const invoice = { id: invRef.id, ...inv.data() };

            // Also save to localStorage
            window.cleartrackData.addInvoice(invoice);

            return invoice;
        } catch (error) {
            console.error('Error adding invoice to Firestore:', error);
            return window.cleartrackData.addInvoice(invoiceData);
        }
    }

    async getInvoicesForPractitioner(practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getInvoicesForPractitioner(practitionerId);
        }

        try {
            const snapshot = await this.db.collection('invoices')
                .where('practitionerId', '==', practitionerId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting invoices from Firestore:', error);
            return window.cleartrackData.getInvoicesForPractitioner(practitionerId);
        }
    }

    // ========== MESSAGES ==========

    async addMessage(userId, practitionerId, messageData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.addMessage(userId, practitionerId, messageData);
        }

        try {
            const msgData = {
                userId: userId,
                practitionerId: practitionerId,
                ...messageData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            const msgRef = await this.db.collection('messages').add(msgData);
            const msg = await msgRef.get();
            const message = { id: msgRef.id, ...msg.data() };

            // Also save to localStorage
            window.cleartrackData.addMessage(userId, practitionerId, message);

            return message;
        } catch (error) {
            console.error('Error adding message to Firestore:', error);
            return window.cleartrackData.addMessage(userId, practitionerId, messageData);
        }
    }

    async getMessages(userId, practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getMessages(userId, practitionerId);
        }

        try {
            // Get messages in both directions:
            // 1. User sends to practitioner (userId == userId, practitionerId == practitionerId)
            // 2. Practitioner sends to user (userId == userId, practitionerId == practitionerId, but sender is 'practitioner')
            // Note: Messages are stored with userId = client.id and practitionerId = practitioner.id regardless of sender
            
            let messages = [];
            
            // Try query with orderBy first
            try {
                const snapshot1 = await this.db.collection('messages')
                    .where('userId', '==', userId)
                    .where('practitionerId', '==', practitionerId)
                    .orderBy('timestamp', 'asc')
                    .get();

                messages = snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (orderByError) {
                // If orderBy fails due to missing index, retry without orderBy
                if (orderByError.code === 'failed-precondition') {
                    console.log('Firestore index missing for messages query, fetching without orderBy and sorting in memory');
                    const snapshot1 = await this.db.collection('messages')
                        .where('userId', '==', userId)
                        .where('practitionerId', '==', practitionerId)
                        .get();
                    messages = snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } else {
                    throw orderByError;
                }
            }

            // Also check reverse direction in case messages were stored differently
            // This handles edge cases where message structure might vary
            try {
                let reverseMessages = [];
                try {
                    const snapshot2 = await this.db.collection('messages')
                        .where('userId', '==', practitionerId)
                        .where('practitionerId', '==', userId)
                        .orderBy('timestamp', 'asc')
                        .get();
                    
                    reverseMessages = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (reverseOrderByError) {
                    // If orderBy fails due to missing index, retry without orderBy
                    if (reverseOrderByError.code === 'failed-precondition') {
                        const snapshot2 = await this.db.collection('messages')
                            .where('userId', '==', practitionerId)
                            .where('practitionerId', '==', userId)
                            .get();
                        reverseMessages = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    } else {
                        throw reverseOrderByError;
                    }
                }
                
                // Merge and deduplicate by message ID
                const messageMap = new Map();
                [...messages, ...reverseMessages].forEach(msg => {
                    if (!messageMap.has(msg.id)) {
                        messageMap.set(msg.id, msg);
                    }
                });
                messages = Array.from(messageMap.values());
            } catch (reverseError) {
                // If reverse query fails (e.g., no index), just use the first query results
                console.log('Reverse message query not available, using primary query only');
            }

            // Sort by timestamp
            messages.sort((a, b) => {
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
                return timeA - timeB;
            });

            return messages;
        } catch (error) {
            console.error('Error getting messages from Firestore:', error);
            return window.cleartrackData.getMessages(userId, practitionerId);
        }
    }

    // Real-time listener for messages
    onMessages(userId, practitionerId, callback) {
        if (!this.isAuthenticated() || !this.db) return () => {};

        const listenerKey = `messages_${userId}_${practitionerId}`;
        
        // Remove existing listener if any
        if (this.listeners[listenerKey]) {
            this.listeners[listenerKey]();
        }

        const unsubscribe = this.db.collection('messages')
            .where('userId', '==', userId)
            .where('practitionerId', '==', practitionerId)
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(messages);
            }, (error) => {
                console.error('Error in messages listener:', error);
            });

        this.listeners[listenerKey] = unsubscribe;
        return unsubscribe;
    }

    async markMessagesAsRead(userId, practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.markMessagesAsRead(userId, practitionerId);
        }

        try {
            const snapshot = await this.db.collection('messages')
                .where('userId', '==', userId)
                .where('practitionerId', '==', practitionerId)
                .where('sender', '==', 'user')
                .where('read', '==', false)
                .get();

            const batch = this.db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();

            // Also update localStorage
            window.cleartrackData.markMessagesAsRead(userId, practitionerId);

            return true;
        } catch (error) {
            console.error('Error marking messages as read in Firestore:', error);
            return window.cleartrackData.markMessagesAsRead(userId, practitionerId);
        }
    }

    // ========== MIGRATION ==========

    // Check if user has write permission to their own user document
    async _canWriteToUserDocument(userId) {
        if (!this.isAuthenticated() || !this.db || !userId) {
            return false;
        }
        
        try {
            // Try to read the user document first (read permission is less strict)
            const userDoc = await this.db.collection('users').doc(userId).get();
            // If we can read it, we likely have write permission (owner check)
            // This is a lightweight permission check
            return userDoc.exists || this.auth.currentUser.uid === userId;
        } catch (error) {
            // If we can't even read, we definitely can't write
            return false;
        }
    }

    async migrateLocalStorageToFirestore() {
        // Guard 1: Check if already attempted this session
        if (this.migrationAttempted) {
            return false; // Already attempted, don't retry
        }
        
        // Guard 2: Basic authentication and DB checks
        if (!this.isAuthenticated() || !this.db) {
            this.migrationAttempted = true; // Mark as attempted to prevent retries
            return false;
        }

        const userId = this.getCurrentUserId();
        if (!userId) {
            this.migrationAttempted = true;
            return false;
        }

        // Guard 3: Check if user has write permissions
        const canWrite = await this._canWriteToUserDocument(userId);
        if (!canWrite) {
            this.migrationAttempted = true;
            console.warn('[firestore-data] Migration skipped: insufficient write permissions for user document');
            return false;
        }

        // Guard 4: Check if migration already completed
        if (this.migrationComplete) {
            this.migrationAttempted = true;
            return true; // Already migrated
        }

        // Mark as attempted before proceeding
        this.migrationAttempted = true;

        try {
            const localData = window.cleartrackData.getData();
            if (!localData) {
                this.migrationComplete = true; // Nothing to migrate, consider it complete
                return true;
            }

            const batch = this.db.batch();
            let hasWrites = false;

            // Migrate documents (user subcollection - requires owner permission)
            if (localData.users && localData.users[userId] && localData.users[userId].documents) {
                for (const doc of localData.users[userId].documents) {
                    const docId = doc.id || this.db.collection('temp').doc().id;
                    const docRef = this.db.collection('users').doc(userId)
                        .collection('documents').doc(docId);
                    const { id, ...docData } = doc;
                    batch.set(docRef, { ...docData, id: docId }, { merge: true });
                    hasWrites = true;
                }
            }

            // Migrate vehicles (user subcollection)
            if (localData.users && localData.users[userId] && localData.users[userId].vehicles) {
                for (const veh of localData.users[userId].vehicles) {
                    const vehId = veh.id || this.db.collection('temp').doc().id;
                    const vehRef = this.db.collection('users').doc(userId)
                        .collection('vehicles').doc(vehId);
                    const { id, ...vehData } = veh;
                    batch.set(vehRef, { ...vehData, id: vehId }, { merge: true });
                    hasWrites = true;
                }
            }

            // Migrate expenses (user subcollection)
            if (localData.users && localData.users[userId] && localData.users[userId].expenses) {
                for (const exp of localData.users[userId].expenses) {
                    const expId = exp.id || this.db.collection('temp').doc().id;
                    const expRef = this.db.collection('users').doc(userId)
                        .collection('expenses').doc(expId);
                    const { id, ...expData } = exp;
                    batch.set(expRef, { ...expData, id: expId }, { merge: true });
                    hasWrites = true;
                }
            }

            // Migrate connections (top-level collection - may have different rules)
            if (localData.connections) {
                for (const connId in localData.connections) {
                    const conn = localData.connections[connId];
                    // Only migrate if userId matches (owner check)
                    if (conn.userId === userId) {
                        const connRef = this.db.collection('connections').doc(conn.id || connId);
                        batch.set(connRef, conn, { merge: true });
                        hasWrites = true;
                    }
                }
            }

            // Migrate connection requests (top-level collection)
            if (localData.connectionRequests) {
                for (const reqId in localData.connectionRequests) {
                    const req = localData.connectionRequests[reqId];
                    // Only migrate if userId matches (owner check)
                    if (req.userId === userId) {
                        const reqRef = this.db.collection('connectionRequests').doc(req.id || reqId);
                        batch.set(reqRef, req, { merge: true });
                        hasWrites = true;
                    }
                }
            }

            // Migrate tax returns (top-level collection)
            if (localData.taxReturns) {
                for (const trId in localData.taxReturns) {
                    const tr = localData.taxReturns[trId];
                    // Only migrate if userId matches (owner check)
                    if (tr.userId === userId) {
                        const trRef = this.db.collection('taxReturns').doc(tr.id || trId);
                        batch.set(trRef, tr, { merge: true });
                        hasWrites = true;
                    }
                }
            }

            // Migrate invoices (top-level collection)
            if (localData.invoices) {
                for (const invId in localData.invoices) {
                    const inv = localData.invoices[invId];
                    // Only migrate if userId matches (owner check)
                    if (inv.userId === userId) {
                        const invRef = this.db.collection('invoices').doc(inv.id || invId);
                        batch.set(invRef, inv, { merge: true });
                        hasWrites = true;
                    }
                }
            }

            // Migrate messages (top-level collection)
            if (localData.messages) {
                for (const msgId in localData.messages) {
                    const msg = localData.messages[msgId];
                    // Only migrate if userId matches (owner check)
                    if (msg.userId === userId) {
                        const msgRef = this.db.collection('messages').doc(msg.id || msgId);
                        batch.set(msgRef, msg, { merge: true });
                        hasWrites = true;
                    }
                }
            }

            // Only commit if there are writes
            if (hasWrites) {
                await batch.commit();
            }

            // Mark migration as complete (only if we successfully wrote or had nothing to write)
            try {
                await this.db.collection('users').doc(userId).update({
                    migrationComplete: true,
                    migrationDate: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (updateError) {
                // If update fails, log but don't fail the entire migration
                if (updateError.code !== 'permission-denied') {
                    console.warn('[firestore-data] Could not mark migration as complete:', updateError);
                }
            }

            this.migrationComplete = true;
            if (hasWrites) {
                console.log('✅ Migration to Firestore completed successfully');
            }
            return true;
        } catch (error) {
            // Handle permission errors silently
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                console.warn('[firestore-data] Migration skipped: insufficient permissions');
                return false;
            }
            // Log other errors but don't throw
            console.warn('[firestore-data] Migration error (non-fatal):', error.message);
            return false;
        }
    }

    // ========== PRACTITIONER LOOKUP ==========

    async getPractitionerByCode(code) {
        // Use window.firebaseDb as fallback if this.db is not set
        const db = this.db || window.firebaseDb;
        
        if (!db) {
            // No Firestore available, fallback to localStorage
            return window.cleartrackData.getPractitionerByCode(code);
        }

        // Check authentication - but don't require it for practitioner lookup (public data)
        // Practitioners can be looked up by code without authentication
        try {
            const upperCode = code.toUpperCase();
            
            // Query Firestore users collection for practitioner with matching code
            const snapshot = await db.collection('users')
                .where('role', '==', 'practitioner')
                .where('practitionerCode', '==', upperCode)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const practitioner = { id: doc.id, ...doc.data() };
                
                // Cache in localStorage for faster future lookups and offline access
                try {
                    const data = window.cleartrackData.getData();
                    if (!data.practitioners) data.practitioners = {};
                    // Preserve existing data and merge with Firestore data
                    const existingPractitioner = data.practitioners[doc.id] || {};
                    data.practitioners[doc.id] = { ...existingPractitioner, ...practitioner };
                    window.cleartrackData.setData(data);
                } catch (e) {
                    console.warn('Could not cache practitioner in localStorage:', e);
                }
                
                return practitioner;
            }

            // Not found in Firestore, fallback to localStorage
            return window.cleartrackData.getPractitionerByCode(code);
        } catch (error) {
            console.error('Error getting practitioner by code from Firestore:', error);
            // Fallback to localStorage
            return window.cleartrackData.getPractitionerByCode(code);
        }
    }

    // PHASE3B: Audit log helper
    async logAuditEvent({ type, clientId, practitionerId, taxYear, vehicleCount, source }) {
        console.log('[PHASE3B-AUDIT] Logging audit event:', { type, clientId, practitionerId, taxYear, vehicleCount, source });
        
        if (!this.isAuthenticated() || !this.db) {
            console.warn('[PHASE3B-AUDIT] Firestore not available, skipping audit log');
            return null;
        }
        
        try {
            const auditData = {
                type: type,
                clientId: clientId || null,
                practitionerId: practitionerId || null,
                taxYear: taxYear || null,
                vehicleCount: vehicleCount || 0,
                source: source || 'unknown',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await this.db.collection('auditLogs').add(auditData);
            console.log('[PHASE3B-AUDIT] Audit event logged:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('[PHASE3B-AUDIT] Error logging audit event:', error);
            return null;
        }
    }

    // PHASE3B: Submission snapshot helper
    async createSubmissionSnapshot({ clientId, practitionerId, taxYear, vehicles, trips, totals }) {
        console.log('[PHASE3B-SNAPSHOT] Creating submission snapshot for client:', clientId);
        
        if (!this.isAuthenticated() || !this.db) {
            console.warn('[PHASE3B-SNAPSHOT] Firestore not available, skipping snapshot');
            return null;
        }
        
        try {
            // Deep copy to prevent reference issues
            const snapshotData = {
                clientId: clientId,
                practitionerId: practitionerId || null,
                taxYear: taxYear ? { ...taxYear } : null,
                vehicles: vehicles ? JSON.parse(JSON.stringify(vehicles)) : [],
                trips: trips ? JSON.parse(JSON.stringify(trips)) : [],
                totals: totals ? JSON.parse(JSON.stringify(totals)) : {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await this.db.collection('submissionSnapshots').add(snapshotData);
            console.log('[PHASE3B-SNAPSHOT] Snapshot created:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('[PHASE3B-SNAPSHOT] Error creating snapshot:', error);
            return null;
        }
    }

    // Clean up listeners
    cleanup() {
        Object.values(this.listeners).forEach(unsubscribe => unsubscribe());
        this.listeners = {};
    }
}

// Safe deferred initializer - call explicitly when Firebase is ready
window.initFirestoreData = function () {
    if (!window.firestoreData && typeof FirestoreDataManager === 'function') {
        window.firestoreData = new FirestoreDataManager();
        console.log('[firestore-data] instance created');
    }
};

// PHASE3B: Expose audit log function via window
window.logAuditEvent = async function(params) {
    if (window.firestoreData && window.firestoreData.logAuditEvent) {
        return await window.firestoreData.logAuditEvent(params);
    } else if (window.firebaseDb) {
        // Fallback direct Firestore call
        try {
            const auditData = {
                ...params,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await window.firebaseDb.collection('auditLogs').add(auditData);
            console.log('[PHASE3B-AUDIT] Audit event logged (fallback):', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('[PHASE3B-AUDIT] Error logging audit event (fallback):', error);
            return null;
        }
    }
};

// PHASE3B: Expose submission snapshot function via window
window.createSubmissionSnapshot = async function(params) {
    if (window.firestoreData && window.firestoreData.createSubmissionSnapshot) {
        return await window.firestoreData.createSubmissionSnapshot(params);
    } else if (window.firebaseDb) {
        // Fallback direct Firestore call
        try {
            const snapshotData = {
                clientId: params.clientId,
                practitionerId: params.practitionerId || null,
                taxYear: params.taxYear ? { ...params.taxYear } : null,
                vehicles: params.vehicles ? JSON.parse(JSON.stringify(params.vehicles)) : [],
                trips: params.trips ? JSON.parse(JSON.stringify(params.trips)) : [],
                totals: params.totals ? JSON.parse(JSON.stringify(params.totals)) : {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await window.firebaseDb.collection('submissionSnapshots').add(snapshotData);
            console.log('[PHASE3B-SNAPSHOT] Snapshot created (fallback):', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('[PHASE3B-SNAPSHOT] Error creating snapshot (fallback):', error);
            return null;
        }
    }
};

console.log("[firestore-data] loaded OK");
