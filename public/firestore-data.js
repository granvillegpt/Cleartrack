/**
 * Firestore Data Manager for ClearTrack
 * 
 * This extends the localStorage-based system with Firestore support.
 * During migration, it uses Firestore as primary with localStorage fallback.
 */

// Prevent duplicate declarations
if (typeof FirestoreDataManager === 'undefined') {
class FirestoreDataManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.migrationComplete = false;
        this.listeners = {}; // Store real-time listeners
        this.init();
    }

    init() {
        // Wait for Firebase to be available
        if (typeof firebase !== 'undefined' && firebase.firestore && firebase.auth) {
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            this.checkMigrationStatus();
        } else {
            // Wait for Firebase
            const checkFirebase = setInterval(() => {
                if (typeof firebase !== 'undefined' && firebase.firestore && firebase.auth) {
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
            // Update user document
            await this.db.collection('users').doc(userId).update({
                connectedPractitioner: practitionerId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Create connection document
            const connectionData = {
                userId: userId,
                practitionerId: practitionerId,
                connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            };

            await this.db.collection('connections').add(connectionData);

            // Also update localStorage for backward compatibility
            window.cleartrackData.connectUserToPractitioner(userId, practitionerId);

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
            // Query users collection for users connected to this practitioner
            // Don't filter by role - just check if they have connectedPractitioner set
            const usersSnapshot = await this.db.collection('users')
                .where('connectedPractitioner', '==', practitionerId)
                .get();

            const connectedUsers = [];
            
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                
                // Get documents count
                const documentsSnapshot = await this.db.collection('users')
                    .doc(userDoc.id)
                    .collection('documents')
                    .get();
                
                // Get expenses
                const expensesSnapshot = await this.db.collection('users')
                    .doc(userDoc.id)
                    .collection('expenses')
                    .get();
                
                const expenses = expensesSnapshot.docs.map(doc => doc.data());
                const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
                
                // Format user data to match expected structure
                connectedUsers.push({
                    id: userDoc.id,
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'Unknown',
                    email: userData.email || '',
                    phone: userData.phone || userData.mobile || '',
                    mobile: userData.mobile || userData.phone || '',
                    connectedPractitioner: practitionerId,
                    connectedAt: userData.connectedAt ? (userData.connectedAt.toDate ? userData.connectedAt.toDate().toISOString() : userData.connectedAt) : new Date().toISOString(),
                    documentCount: documentsSnapshot.size,
                    expenseCount: expensesSnapshot.size,
                    totalExpenses: totalExpenses,
                    isActive: documentsSnapshot.size > 0 || expensesSnapshot.size > 0,
                    documents: documentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                    expenses: expenses,
                    vehicles: [] // Will be populated if needed
                });
            }

            // Also update localStorage for backward compatibility
            const localStorageUsers = window.cleartrackData.getConnectedUsers(practitionerId);
            
            return connectedUsers;
        } catch (error) {
            console.error('Error getting connected users from Firestore:', error);
            // Fallback to localStorage
            return window.cleartrackData.getConnectedUsers(practitionerId);
        }
    }

    // ========== CONNECTION REQUESTS ==========

    async sendConnectionRequest(userId, practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.sendConnectionRequest(userId, practitionerId);
        }

        try {
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

            const requestRef = await this.db.collection('connectionRequests').add(requestData);
            const requestDoc = await requestRef.get();
            const request = { id: requestRef.id, ...requestDoc.data() };

            // Also save to localStorage for backward compatibility
            window.cleartrackData.sendConnectionRequest(userId, practitionerId);

            return { success: true, request: request };
        } catch (error) {
            console.error('Error sending connection request in Firestore:', error);
            return window.cleartrackData.sendConnectionRequest(userId, practitionerId);
        }
    }

    async getConnectionRequests(practitionerId) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.getConnectionRequests(practitionerId);
        }

        try {
            const snapshot = await this.db.collection('connectionRequests')
                .where('practitionerId', '==', practitionerId)
                .where('status', '==', 'pending')
                .orderBy('timestamp', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting connection requests from Firestore:', error);
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

    // ========== VEHICLES ==========

    async addVehicle(userId, vehicleData) {
        if (!this.isAuthenticated() || !this.db) {
            return window.cleartrackData.addVehicle(userId, vehicleData);
        }

        try {
            const vehData = {
                ...vehicleData,
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
            // Get messages where user is sender or receiver
            const snapshot1 = await this.db.collection('messages')
                .where('userId', '==', userId)
                .where('practitionerId', '==', practitionerId)
                .orderBy('timestamp', 'asc')
                .get();

            const messages = snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

    async migrateLocalStorageToFirestore() {
        if (!this.isAuthenticated() || !this.db) {
            console.warn('Cannot migrate: not authenticated or Firestore not available');
            return false;
        }

        try {
            const localData = window.cleartrackData.getData();
            if (!localData) return true; // Nothing to migrate

            const userId = this.getCurrentUserId();
            const batch = this.db.batch();

            // Migrate documents
            if (localData.users && localData.users[userId] && localData.users[userId].documents) {
                for (const doc of localData.users[userId].documents) {
                    const docId = doc.id || this.db.collection('temp').doc().id;
                    const docRef = this.db.collection('users').doc(userId)
                        .collection('documents').doc(docId);
                    const { id, ...docData } = doc; // Remove id from data, use it as doc ID
                    batch.set(docRef, { ...docData, id: docId }, { merge: true });
                }
            }

            // Migrate vehicles
            if (localData.users && localData.users[userId] && localData.users[userId].vehicles) {
                for (const veh of localData.users[userId].vehicles) {
                    const vehId = veh.id || this.db.collection('temp').doc().id;
                    const vehRef = this.db.collection('users').doc(userId)
                        .collection('vehicles').doc(vehId);
                    const { id, ...vehData } = veh; // Remove id from data
                    batch.set(vehRef, { ...vehData, id: vehId }, { merge: true });
                }
            }

            // Migrate expenses
            if (localData.users && localData.users[userId] && localData.users[userId].expenses) {
                for (const exp of localData.users[userId].expenses) {
                    const expId = exp.id || this.db.collection('temp').doc().id;
                    const expRef = this.db.collection('users').doc(userId)
                        .collection('expenses').doc(expId);
                    const { id, ...expData } = exp; // Remove id from data
                    batch.set(expRef, { ...expData, id: expId }, { merge: true });
                }
            }

            // Migrate connections
            if (localData.connections) {
                for (const connId in localData.connections) {
                    const conn = localData.connections[connId];
                    const connRef = this.db.collection('connections').doc(conn.id || connId);
                    batch.set(connRef, conn, { merge: true });
                }
            }

            // Migrate connection requests
            if (localData.connectionRequests) {
                for (const reqId in localData.connectionRequests) {
                    const req = localData.connectionRequests[reqId];
                    const reqRef = this.db.collection('connectionRequests').doc(req.id || reqId);
                    batch.set(reqRef, req, { merge: true });
                }
            }

            // Migrate tax returns
            if (localData.taxReturns) {
                for (const trId in localData.taxReturns) {
                    const tr = localData.taxReturns[trId];
                    const trRef = this.db.collection('taxReturns').doc(tr.id || trId);
                    batch.set(trRef, tr, { merge: true });
                }
            }

            // Migrate invoices
            if (localData.invoices) {
                for (const invId in localData.invoices) {
                    const inv = localData.invoices[invId];
                    const invRef = this.db.collection('invoices').doc(inv.id || invId);
                    batch.set(invRef, inv, { merge: true });
                }
            }

            // Migrate messages
            if (localData.messages) {
                for (const msgId in localData.messages) {
                    const msg = localData.messages[msgId];
                    const msgRef = this.db.collection('messages').doc(msg.id || msgId);
                    batch.set(msgRef, msg, { merge: true });
                }
            }

            await batch.commit();

            // Mark migration as complete
            await this.db.collection('users').doc(userId).update({
                migrationComplete: true,
                migrationDate: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.migrationComplete = true;
            console.log('✅ Migration to Firestore completed successfully');
            return true;
        } catch (error) {
            console.error('Error migrating to Firestore:', error);
            return false;
        }
    }

    // ========== PRACTITIONER LOOKUP ==========

    async getPractitionerByCode(code) {
        if (!this.isAuthenticated() || !this.db) {
            // Fallback to localStorage
            return window.cleartrackData.getPractitionerByCode(code);
        }

        try {
            // Query Firestore users collection for practitioner with matching code
            const snapshot = await this.db.collection('users')
                .where('role', '==', 'practitioner')
                .where('practitionerCode', '==', code.toUpperCase())
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const practitioner = { id: doc.id, ...doc.data() };
                
                // Cache in localStorage for faster future lookups
                try {
                    const data = window.cleartrackData.getData();
                    if (!data.practitioners) data.practitioners = {};
                    data.practitioners[doc.id] = practitioner;
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

    // Clean up listeners
    cleanup() {
        Object.values(this.listeners).forEach(unsubscribe => unsubscribe());
        this.listeners = {};
    }
}

// Create global instance (only if not already created)
if (!window.firestoreData) {
    window.firestoreData = new FirestoreDataManager();
}
}

