// Shared Data Storage System for Cleartrack
// This file provides a unified data layer for user-practitioner connections

class CleartrackDataManager {
    constructor() {
        this.storageKey = 'cleartrack_data';
        this.connectionsKey = 'cleartrack_connections';
        this.usersKey = 'cleartrack_users';
        this.practitionersKey = 'cleartrack_practitioners';
        this.initializeData();
    }

    // Initialize default data structure
    initializeData() {
        if (!this.getData()) {
            this.setData({
                users: {},
                practitioners: {},
                connections: {},
                documents: {},
                vehicles: {},
                expenses: {},
                taxReturns: {},
                messages: {}
            });
        }
    }

    // Generic data storage methods
    getData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            const parsedData = data ? JSON.parse(data) : null;
            
            // Ensure messages object exists and is not null
            if (parsedData && (!parsedData.messages || parsedData.messages === null)) {
                parsedData.messages = {};
                this.setData(parsedData);
            }
            
            return parsedData;
        } catch (error) {
            console.error('Error reading data:', error);
            return null;
        }
    }

    setData(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    // User management
    createUser(userData) {
        const data = this.getData();
        const userId = 'user_' + Date.now();
        
        const user = {
            id: userId,
            ...userData,
            createdAt: new Date().toISOString(),
            connectedPractitioner: null,
            documents: [],
            vehicles: [],
            expenses: []
        };

        data.users[userId] = user;
        this.setData(data);
        return user;
    }

    getUser(userId) {
        const data = this.getData();
        return data.users[userId] || null;
    }

    updateUser(userId, updates) {
        const data = this.getData();
        if (data.users[userId]) {
            data.users[userId] = { ...data.users[userId], ...updates };
            this.setData(data);
            return data.users[userId];
        }
        return null;
    }

    // Practitioner management
    createPractitioner(practitionerData) {
        const data = this.getData();
        const practitionerId = 'prac_' + Date.now();
        
        const practitioner = {
            id: practitionerId,
            ...practitionerData,
            createdAt: new Date().toISOString(),
            connectedUsers: [],
            practitionerCode: this.generatePractitionerCode()
        };

        data.practitioners[practitionerId] = practitioner;
        this.setData(data);
        return practitioner;
    }

    getPractitioner(practitionerId) {
        const data = this.getData();
        if (!data || !data.practitioners) return null;
        return data.practitioners[practitionerId] || null;
    }

    getPractitionerByCode(code) {
        const data = this.getData();
        if (!data || !data.practitioners) return null;
        
        for (let practitionerId in data.practitioners) {
            if (data.practitioners[practitionerId].practitionerCode === code) {
                return data.practitioners[practitionerId];
            }
        }
        return null;
    }

    updatePractitioner(practitionerId, updates) {
        const data = this.getData();
        if (data.practitioners[practitionerId]) {
            data.practitioners[practitionerId] = { ...data.practitioners[practitionerId], ...updates };
            this.setData(data);
            return data.practitioners[practitionerId];
        }
        return null;
    }

    // Connection management
    connectUserToPractitioner(userId, practitionerId) {
        try {
            if (!userId || !practitionerId) {
                return false;
            }

            const data = this.getData();
            
            if (!data.users[userId]) {
                return false;
            }
            
            if (!data.practitioners[practitionerId]) {
                return false;
            }

            // Check if already connected
            if (data.users[userId].connectedPractitioner) {
                return false;
            }
            
            // Update user
            data.users[userId].connectedPractitioner = practitionerId;
            
            // Initialize connectedUsers array if it doesn't exist
            if (!data.practitioners[practitionerId].connectedUsers) {
                data.practitioners[practitionerId].connectedUsers = [];
            }
            
            // Update practitioner
            if (!data.practitioners[practitionerId].connectedUsers.includes(userId)) {
                data.practitioners[practitionerId].connectedUsers.push(userId);
            }
            
            // Initialize connections if it doesn't exist
            if (!data.connections) {
                data.connections = {};
            }
            
            // Create connection record
            const connectionId = 'conn_' + Date.now();
            data.connections[connectionId] = {
                id: connectionId,
                userId: userId,
                practitionerId: practitionerId,
                connectedAt: new Date().toISOString(),
                status: 'active'
            };
            
            this.setData(data);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Check if user is connected to practitioner
    isUserConnectedToPractitioner(userId, practitionerId) {
        try {
            const data = this.getData();
            
            if (!data.users[userId] || !data.practitioners[practitionerId]) {
                return false;
            }
            
            // Check if user is connected to this practitioner
            const userConnectedPractitioner = data.users[userId].connectedPractitioner;
            if (userConnectedPractitioner === practitionerId) {
                return true;
            }
            
            // Also check if practitioner has this user in their connected users
            const practitionerConnectedUsers = data.practitioners[practitionerId].connectedUsers || [];
            if (practitionerConnectedUsers.includes(userId)) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking user-practitioner connection:', error);
            return false;
        }
    }

    disconnectUserFromPractitioner(userId) {
        try {
            const data = this.getData();
            
            // Validate data structure
            if (!data) {
                return false;
            }
            
            if (!data.users || !data.users[userId]) {
                return false;
            }
            
            if (!data.users[userId].connectedPractitioner) {
                return false;
            }
            
            const practitionerId = data.users[userId].connectedPractitioner;
            
            // Update user - remove connection
            data.users[userId].connectedPractitioner = null;
            
            // Update practitioner - remove user from connectedUsers
            if (data.practitioners && data.practitioners[practitionerId]) {
                if (!data.practitioners[practitionerId].connectedUsers) {
                    data.practitioners[practitionerId].connectedUsers = [];
                }
                data.practitioners[practitionerId].connectedUsers = 
                    data.practitioners[practitionerId].connectedUsers.filter(id => id !== userId);
            }
            
            // Update connection status
            if (data.connections) {
                for (let connectionId in data.connections) {
                    if (data.connections[connectionId].userId === userId && 
                        data.connections[connectionId].status === 'active') {
                        data.connections[connectionId].status = 'disconnected';
                        data.connections[connectionId].disconnectedAt = new Date().toISOString();
                    }
                }
            }
            
            this.setData(data);
            return true;
        } catch (error) {
            return false;
        }
    }

    // Document management
    addDocument(userId, documentData) {
        const data = this.getData();
        if (data.users[userId]) {
            // Ensure documents array exists
            if (!data.users[userId].documents) {
                data.users[userId].documents = [];
            }
            
            const document = {
                ...documentData,
                id: documentData.id || 'doc_' + Date.now(),
                uploadedAt: new Date().toISOString()
            };
            
            data.users[userId].documents.push(document);
            this.setData(data);
            return document;
        }
        return null;
    }

    updateDocument(userId, documentData) {
        const data = this.getData();
        if (data.users[userId] && data.users[userId].documents) {
            const docIndex = data.users[userId].documents.findIndex(doc => String(doc.id) === String(documentData.id));
            if (docIndex !== -1) {
                data.users[userId].documents[docIndex] = {
                    ...data.users[userId].documents[docIndex],
                    ...documentData,
                    uploadedAt: new Date().toISOString()
                };
                this.setData(data);
                return data.users[userId].documents[docIndex];
            }
        }
        return null;
    }

    deleteDocument(userId, documentId) {
        const data = this.getData();
        if (data.users[userId] && data.users[userId].documents) {
            data.users[userId].documents = data.users[userId].documents.filter(doc => String(doc.id) !== String(documentId));
            this.setData(data);
            return true;
        }
        return false;
    }

    getUserDocuments(userId) {
        const data = this.getData();
        if (data.users[userId]) {
            // Ensure documents array exists
            if (!data.users[userId].documents) {
                data.users[userId].documents = [];
            }
            return data.users[userId].documents;
        }
        return [];
    }

    // Vehicle management
    addVehicle(userId, vehicleData) {
        const data = this.getData();
        if (data.users[userId]) {
            // Ensure vehicles array exists
            if (!data.users[userId].vehicles) {
                data.users[userId].vehicles = [];
            }
            
            const vehicle = {
                id: 'veh_' + Date.now(),
                ...vehicleData,
                addedAt: new Date().toISOString()
            };
            
            data.users[userId].vehicles.push(vehicle);
            this.setData(data);
            return vehicle;
        }
        return null;
    }

    getUserVehicles(userId) {
        const data = this.getData();
        if (data.users[userId]) {
            // Ensure vehicles array exists
            if (!data.users[userId].vehicles) {
                data.users[userId].vehicles = [];
            }
            return data.users[userId].vehicles;
        }
        return [];
    }

    // Expense management
    addExpense(userId, expenseData) {
        const data = this.getData();
        if (data.users[userId]) {
            // Ensure expenses array exists
            if (!data.users[userId].expenses) {
                data.users[userId].expenses = [];
            }
            
            const expense = {
                id: 'exp_' + Date.now(),
                ...expenseData,
                recordedAt: new Date().toISOString()
            };
            
            data.users[userId].expenses.push(expense);
            this.setData(data);
            return expense;
        }
        return null;
    }

    getUserExpenses(userId) {
        const data = this.getData();
        if (data.users[userId]) {
            // Ensure expenses array exists
            if (!data.users[userId].expenses) {
                data.users[userId].expenses = [];
            }
            return data.users[userId].expenses;
        }
        return [];
    }

    // Tax return management
    createTaxReturn(practitionerId, userId, taxReturnData) {
        const data = this.getData();
        const taxReturnId = 'tr_' + Date.now();
        
        const taxReturn = {
            id: taxReturnId,
            practitionerId: practitionerId,
            userId: userId,
            ...taxReturnData,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        data.taxReturns[taxReturnId] = taxReturn;
        this.setData(data);
        return taxReturn;
    }

    // Update tax return status
    updateTaxReturnStatus(returnId, newStatus) {
        const data = this.getData();
        
        if (!data.taxReturns[returnId]) {
            return false;
        }
        
        // Update the status and completion date if marking as completed
        data.taxReturns[returnId].status = newStatus;
        if (newStatus === 'completed') {
            data.taxReturns[returnId].completedAt = new Date().toISOString();
        }
        
        this.setData(data);
        return true;
    }

    // Invoice management
    addInvoice(invoiceData) {
        const data = this.getData();
        
        if (!data.invoices) {
            data.invoices = {};
        }
        
        data.invoices[invoiceData.id] = invoiceData;
        this.setData(data);
        return invoiceData;
    }

    getInvoicesForPractitioner(practitionerId) {
        console.log('🔍 getInvoicesForPractitioner called for practitioner:', practitionerId);
        const data = this.getData();
        const practitionerInvoices = [];
        
        if (!data.invoices) {
            console.log('❌ No invoices in data storage');
            return [];
        }
        
        console.log('📋 All invoices in storage:', Object.keys(data.invoices).length);
        
        for (let invoiceId in data.invoices) {
            const invoice = data.invoices[invoiceId];
            console.log('🔍 Checking invoice:', invoiceId, 'practitionerId:', invoice.practitionerId);
            
            // Only include invoices for this practitioner
            if (invoice.practitionerId === practitionerId) {
                console.log('✅ Invoice belongs to practitioner');
                // CRITICAL: Check if user is still connected to practitioner
                // We need to find the user ID from the invoice data
                const userId = this.findUserIdFromInvoice(invoice);
                console.log('👤 Found user ID:', userId);
                
                if (userId && this.isUserConnectedToPractitioner(userId, practitionerId)) {
                    console.log('✅ User still connected, adding invoice');
                    practitionerInvoices.push(invoice);
                } else if (!userId) {
                    // If we can't find the user, still include the invoice (temporary fix)
                    console.log('⚠️ Could not find user for invoice, but including it anyway');
                    practitionerInvoices.push(invoice);
                } else {
                    // User is no longer connected - remove this invoice
                    console.log(`❌ Removing invoice ${invoiceId} - user no longer connected to practitioner ${practitionerId}`);
                    delete data.invoices[invoiceId];
                }
            } else {
                console.log('❌ Invoice does not belong to practitioner');
            }
        }
        
        // Save updated data if any invoices were removed
        this.setData(data);
        
        console.log('📋 Final practitioner invoices:', practitionerInvoices.length);
        return practitionerInvoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Helper method to find user ID from invoice data
    findUserIdFromInvoice(invoice) {
        console.log('🔍 findUserIdFromInvoice called for invoice:', invoice.clientName);
        const data = this.getData();
        
        // Try to find user by client name in the invoice
        if (invoice.clientName) {
            console.log('🔍 Looking for user with name:', invoice.clientName);
            for (let userId in data.users) {
                const user = data.users[userId];
                const fullName = `${user.firstName} ${user.lastName}`;
                console.log('🔍 Checking user:', userId, 'name:', fullName);
                if (fullName === invoice.clientName) {
                    console.log('✅ Found matching user:', userId);
                    return userId;
                }
            }
            console.log('❌ No matching user found for:', invoice.clientName);
        } else {
            console.log('❌ No client name in invoice');
        }
        
        // If not found by name, return null
        return null;
    }

    // Bank details management
    savePractitionerBankDetails(bankDetails) {
        const data = this.getData();
        
        if (!data.practitionerBankDetails) {
            data.practitionerBankDetails = {};
        }
        
        data.practitionerBankDetails = bankDetails;
        this.setData(data);
        return bankDetails;
    }

    getPractitionerBankDetails() {
        const data = this.getData();
        return data.practitionerBankDetails || null;
    }

    getTaxReturnsForPractitioner(practitionerId) {
        const data = this.getData();
        const practitionerTaxReturns = [];
        
        for (let taxReturnId in data.taxReturns) {
            const taxReturn = data.taxReturns[taxReturnId];
            
            // Only include tax returns for this practitioner
            if (taxReturn.practitionerId === practitionerId) {
                // CRITICAL: Check if user is still connected to practitioner
                if (this.isUserConnectedToPractitioner(taxReturn.userId, practitionerId)) {
                    const user = data.users[taxReturn.userId];
                    practitionerTaxReturns.push({
                        ...taxReturn,
                        clientName: user ? `${user.firstName} ${user.lastName}` : 'Unknown Client'
                    });
                } else {
                    // User is no longer connected - remove this tax return
                    console.log(`Removing tax return ${taxReturnId} - user ${taxReturn.userId} no longer connected to practitioner ${practitionerId}`);
                    delete data.taxReturns[taxReturnId];
                }
            }
        }
        
        // Save updated data if any tax returns were removed
        this.setData(data);
        
        return practitionerTaxReturns;
    }

    // Utility methods
    generatePractitionerCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Get all connected users for a practitioner
    getConnectedUsers(practitionerId) {
        const data = this.getData();
        if (!data || !data.practitioners || !data.practitioners[practitionerId]) {
            return [];
        }

        const practitioner = data.practitioners[practitionerId];

        // Fallback/healing: if connectedUsers is missing or empty, derive from users table
        if (!Array.isArray(practitioner.connectedUsers) || practitioner.connectedUsers.length === 0) {
            const derived = [];
            if (data.users) {
                for (let userId in data.users) {
                    const user = data.users[userId];
                    if (user && user.connectedPractitioner === practitionerId) {
                        derived.push(userId);
                    }
                }
            }
            // Heal the data if we derived any connections
            if (derived.length > 0) {
                practitioner.connectedUsers = Array.from(new Set(derived));
                data.practitioners[practitionerId] = practitioner;
                this.setData(data);
            }
        }

        const connectedIds = Array.isArray(practitioner.connectedUsers) ? practitioner.connectedUsers : [];

        const connectedUsers = connectedIds.map(userId => {
            const user = data.users ? data.users[userId] : null;
            if (!user) return null;
            return {
                ...user,
                documentCount: user.documents ? user.documents.length : 0,
                vehicleCount: user.vehicles ? user.vehicles.length : 0,
                vehicles: user.vehicles || [],
                expenseCount: user.expenses ? user.expenses.length : 0,
                totalExpenses: user.expenses ? user.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0) : 0
            };
        }).filter(Boolean);

        return connectedUsers;
    }

    // Get user's connected practitioner
    getConnectedPractitioner(userId) {
        const data = this.getData();
        const user = data.users[userId];
        
        if (user && user.connectedPractitioner) {
            return data.practitioners[user.connectedPractitioner];
        }
        
        return null;
    }

    // Get current user (returns first user)
    getCurrentUser() {
        const data = this.getData();
        const userIds = Object.keys(data.users);
        
        if (userIds.length > 0) {
            return data.users[userIds[0]];
        }
        
        return null;
    }

    // Clear all data (for testing)
    clearAllData() {
        localStorage.removeItem(this.storageKey);
        this.initializeData();
    }

    // Clear sample practitioners only
    clearSamplePractitioners() {
        const data = this.getData();
        if (data && data.practitioners) {
            // Remove any practitioners with sample names
            const sampleNames = ['Dr. Sarah Johnson', 'Ms. Lisa Brown', 'Sarah Johnson', 'Lisa Brown'];
            const samplePractices = ['Johnson Tax Services', 'Brown Tax Solutions'];
            
            for (let practitionerId in data.practitioners) {
                const practitioner = data.practitioners[practitionerId];
                if (sampleNames.includes(practitioner.name) || 
                    samplePractices.includes(practitioner.practiceName)) {
                    delete data.practitioners[practitionerId];
                }
            }
            this.setData(data);
        }
    }

    // Clear all connections and reset user state
    clearAllConnections() {
        const data = this.getData();
        if (data && data.users) {
            // Remove all connectedPractitioner references
            for (let userId in data.users) {
                if (data.users[userId].connectedPractitioner) {
                    delete data.users[userId].connectedPractitioner;
                }
            }
            // Clear all connection requests
            if (data.connectionRequests) {
                data.connectionRequests = {};
            }
            this.setData(data);
        }
    }

    // Export data (for backup)
    exportData() {
        return this.getData();
    }

    // Import data (for restore)
    importData(data) {
        this.setData(data);
    }

    // Message management
    addMessage(userId, practitionerId, messageData) {
        // Simple logging for document messages
        if (messageData.type === 'document' || messageData.type === 'image') {
            console.log('📎 Document message being saved:', {
                fileName: messageData.fileName,
                fileType: messageData.fileType,
                fileSize: messageData.fileSize
            });
        }
        
        const data = this.getData();
        const messageId = 'msg_' + Date.now();
        
        const message = {
            id: messageId,
            userId: userId,
            practitionerId: practitionerId,
            ...messageData,
            timestamp: new Date().toISOString()
        };
        
        if (!data.messages || data.messages === null) {
            data.messages = {};
        }
        
        data.messages[messageId] = message;
        this.setData(data);
        
        // Simple success logging
        if (message.type === 'document' || message.type === 'image') {
            console.log('✅ Document saved successfully:', message.fileName);
        }
        
        return message;
    }

    getMessages(userId, practitionerId) {
        const data = this.getData();
        if (!data.messages || data.messages === null) {
            return [];
        }
        
        const messages = [];
        for (let messageId in data.messages) {
            const message = data.messages[messageId];
            const mUser = String(message.userId);
            const mPract = String(message.practitionerId);
            const uId = String(userId);
            const pId = String(practitionerId);
            
            // Primary match (exact pair in either direction)
            if ((mUser === uId && mPract === pId) || (mUser === pId && mPract === uId)) {
                messages.push(message);
                continue;
            }
            
            // Fallback match for legacy/swap/missing typing: both ids appear among the two fields
            if ((mUser === uId || mPract === uId) && (mUser === pId || mPract === pId)) {
                messages.push(message);
            }
        }
        
        // Sort by timestamp
        return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    getUnreadMessageCount(userId, practitionerId) {
        const messages = this.getMessages(userId, practitionerId);
        return messages.filter(msg => msg.sender === 'user' && !msg.read).length;
    }

    markMessagesAsRead(userId, practitionerId) {
        const data = this.getData();
        if (!data.messages) return;
        
        for (let messageId in data.messages) {
            const message = data.messages[messageId];
            if (message.userId === userId && message.practitionerId === practitionerId && message.sender === 'user') {
                message.read = true;
            }
        }
        
        this.setData(data);
    }

    // Get all practitioners
    getAllPractitioners() {
        const data = this.getData();
        if (!data || !data.practitioners) return [];
        
        // Only return practitioners who are publicly visible
        return Object.values(data.practitioners).filter(practitioner => practitioner.isPubliclyVisible === true);
    }

    // Connection request management - Rebuilt system
    sendConnectionRequest(userId, practitionerId) {
        try {
            // Validate inputs
            if (!userId || !practitionerId) {
                return { success: false, error: 'Invalid parameters' };
            }

            // Get or initialize data
            let data = this.getData();
            if (!data) {
                data = {
                    users: {},
                    practitioners: {},
                    connections: {},
                    connectionRequests: {},
                    documents: {},
                    vehicles: {},
                    expenses: {},
                    taxReturns: {}
                };
                this.setData(data);
            }

            // Ensure required structures exist
            if (!data.users) data.users = {};
            if (!data.practitioners) data.practitioners = {};
            if (!data.connectionRequests) data.connectionRequests = {};

            // Check if user exists
            if (!data.users[userId]) {
                return { success: false, error: 'User not found' };
            }
            
            // Check if practitioner exists
            if (!data.practitioners[practitionerId]) {
                return { success: false, error: 'Practitioner not found' };
            }

            // Check if user is already connected to the same practitioner
            if (data.users[userId].connectedPractitioner === practitionerId) {
                return { success: false, error: 'User already connected to this practitioner' };
            }
            
            // If user is connected to a different practitioner, allow reconnection
            if (data.users[userId].connectedPractitioner && data.users[userId].connectedPractitioner !== practitionerId) {
                // Disconnect from current practitioner first
                delete data.users[userId].connectedPractitioner;
                this.setData(data);
            }

            // Check for existing pending request
                for (let requestId in data.connectionRequests) {
                    const existingRequest = data.connectionRequests[requestId];
                    if (existingRequest.userId === userId && 
                        existingRequest.practitionerId === practitionerId && 
                        existingRequest.status === 'pending') {
                    return { success: true, request: existingRequest, message: 'Request already exists' };
                }
            }
            
            // Create new connection request
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const request = {
                id: requestId,
                userId: userId,
                practitionerId: practitionerId,
                status: 'pending',
                timestamp: new Date().toISOString(),
                user: data.users[userId],
                practitioner: data.practitioners[practitionerId]
            };
            
            data.connectionRequests[requestId] = request;
            this.setData(data);
            
            return { success: true, request: request };
        } catch (error) {
            console.error('Error in sendConnectionRequest:', error);
            return { success: false, error: 'System error occurred' };
        }
    }

    getConnectionRequests(practitionerId) {
        const data = this.getData();
        if (!data || !data.connectionRequests) return [];
        
        return Object.values(data.connectionRequests).filter(req => 
            req.practitionerId === practitionerId && req.status === 'pending'
        );
    }

    updateConnectionRequest(requestId, status) {
        const data = this.getData();
        if (!data.connectionRequests || !data.connectionRequests[requestId]) return null;
        
        data.connectionRequests[requestId].status = status;
        this.setData(data);
        return data.connectionRequests[requestId];
    }
}

// Create global instance
window.cleartrackData = new CleartrackDataManager();


