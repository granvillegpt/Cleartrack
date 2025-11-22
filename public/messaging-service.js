// WhatsApp-style Messaging Service for ClearTrack
// This service handles all messaging functionality using the backend API

class MessagingService {
    constructor() {
        this.baseURL = '/api/messages';
        this.currentConversation = null;
        this.messagePollingInterval = null;
        this.pollingInterval = 3000; // Poll every 3 seconds
    }

    // Initialize messaging service
    async initialize() {
        try {
            // Start polling for new messages
            this.startMessagePolling();
            return true;
        } catch (error) {
            console.error('Failed to initialize messaging service:', error);
            return false;
        }
    }

    // Send a message
    async sendMessage(recipientId, content, messageType = 'text', replyTo = null, attachment = null) {
        console.log('📤 MessagingService.sendMessage called:', {
            recipientId,
            content,
            messageType,
            replyTo,
            attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null
        });
        
        try {
            // Skip API calls when running from file:// protocol to prevent CORS errors
            if (window.location.protocol === 'file:') {
                console.log('🔄 Skipping API call - running from file:// protocol');
                return this.sendMessageLocal(recipientId, content, messageType, replyTo, attachment);
            }
            
            // First try backend API if available
            if (this.getAuthToken()) {
                const formData = new FormData();
                formData.append('recipientId', recipientId);
                formData.append('content', content);
                formData.append('messageType', messageType);
                if (replyTo) formData.append('replyTo', replyTo);
                if (attachment) formData.append('attachment', attachment);

                const response = await fetch(`${this.baseURL}/send`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.getAuthToken()}`
                    },
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    return result.data;
                }
            }
            
            // Fallback to local storage system
            return this.sendMessageLocal(recipientId, content, messageType, replyTo, attachment);
        } catch (error) {
            console.error('Send message error:', error);
            // Fallback to local storage system
            return this.sendMessageLocal(recipientId, content, messageType, replyTo, attachment);
        }
    }

    // Send message using local storage
    sendMessageLocal(recipientId, content, messageType = 'text', replyTo = null, attachment = null) {
        console.log('💾 MessagingService.sendMessageLocal called:', {
            recipientId,
            content,
            messageType,
            replyTo,
            attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null
        });
        
        try {
            const currentUserId = this.getCurrentUserId();
            console.log('🔍 Current user ID:', currentUserId);
            
            if (!currentUserId) {
                console.error('No current user ID found. Available data:', {
                    localStorage: localStorage.getItem('user'),
                    cleartrackData: window.cleartrackData,
                    practitioner: typeof practitioner !== 'undefined' ? practitioner : 'undefined'
                });
                throw new Error('User not authenticated');
            }

            const messageData = {
                text: content,
                sender: 'user',
                type: messageType,
                replyTo: replyTo,
                sent: true,
                delivered: false,
                read: false
            };

            // Handle file attachment
            if (attachment && attachment instanceof File) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const attachmentData = {
                            fileName: attachment.name,
                            fileType: attachment.type,
                            fileSize: attachment.size,
                            fileData: e.target.result
                        };
                        
                        const messageWithAttachment = {
                            ...messageData,
                            attachment: attachmentData
                        };
                        
                        console.log('📎 Message with attachment created:', {
                            type: messageWithAttachment.type,
                            hasAttachment: !!messageWithAttachment.attachment,
                            attachmentFileName: messageWithAttachment.attachment.fileName,
                            attachmentFileType: messageWithAttachment.attachment.fileType,
                            attachmentFileSize: messageWithAttachment.attachment.fileSize,
                            hasFileData: !!messageWithAttachment.attachment.fileData
                        });
                        
                        // Use the shared data manager to add message
                        if (window.cleartrackData && typeof cleartrackData.addMessage === 'function') {
                            const message = cleartrackData.addMessage(currentUserId, recipientId, messageWithAttachment);
                            resolve(message);
                        } else {
                            // Fallback: create message manually and store in localStorage
                            const messageId = 'msg_' + Date.now();
                            const message = {
                                id: messageId,
                                userId: currentUserId,
                                practitionerId: recipientId,
                                ...messageWithAttachment,
                                timestamp: new Date().toISOString()
                            };
                            
                            // Store in localStorage as fallback
                            const existingMessages = JSON.parse(localStorage.getItem('cleartrack_messages') || '{}');
                            existingMessages[messageId] = message;
                            localStorage.setItem('cleartrack_messages', JSON.stringify(existingMessages));
                            
                            resolve(message);
                        }
                    };
                    reader.onerror = function(error) {
                        reject(error);
                    };
                    reader.readAsDataURL(attachment);
                });
            } else {
                // No attachment, proceed normally
                // Use the shared data manager to add message
                if (window.cleartrackData && typeof cleartrackData.addMessage === 'function') {
                    return cleartrackData.addMessage(currentUserId, recipientId, messageData);
                } else {
                    // Fallback: create message manually and store in localStorage
                    const messageId = 'msg_' + Date.now();
                    const message = {
                        id: messageId,
                        userId: currentUserId,
                        practitionerId: recipientId,
                        ...messageData,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Store in localStorage as fallback
                    const existingMessages = JSON.parse(localStorage.getItem('cleartrack_messages') || '{}');
                    existingMessages[messageId] = message;
                    localStorage.setItem('cleartrack_messages', JSON.stringify(existingMessages));
                    
                    return message;
                }
            }
        } catch (error) {
            console.error('Send message local error:', error);
            throw error;
        }
    }

    // Get all conversations
    async getConversations() {
        try {
            const response = await fetch(`${this.baseURL}/conversations`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch conversations');
            }

            const result = await response.json();
            return result.conversations;
        } catch (error) {
            console.error('Get conversations error:', error);
            throw error;
        }
    }

    // Get conversation with specific user
    async getConversation(userId, page = 1, limit = 50) {
        try {
            // First try backend API if available
            if (this.getAuthToken()) {
                const response = await fetch(`${this.baseURL}/conversation/${userId}?page=${page}&limit=${limit}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.getAuthToken()}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    return result;
                }
            }
            
            // Fallback to local storage system
            return this.getConversationLocal(userId);
        } catch (error) {
            console.error('Get conversation error:', error);
            // Fallback to local storage system
            return this.getConversationLocal(userId);
        }
    }

    // Get conversation using local storage
    getConversationLocal(userId) {
        try {
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                throw new Error('User not authenticated');
            }

            // Use the shared data manager to get messages
            if (window.cleartrackData && typeof cleartrackData.getMessages === 'function') {
                // Try both directions to find messages
                let messages = cleartrackData.getMessages(currentUserId, userId);
                if (messages.length === 0) {
                    messages = cleartrackData.getMessages(userId, currentUserId);
                }
                return {
                    messages: messages,
                    unreadCount: 0,
                    otherUser: {
                        id: userId,
                        name: 'Practitioner',
                        email: '',
                        isPractitioner: true
                    }
                };
            } else {
                // Fallback: get messages from localStorage
                const allMessages = JSON.parse(localStorage.getItem('cleartrack_messages') || '{}');
                const messages = Object.values(allMessages).filter(msg => 
                    (msg.userId === currentUserId && msg.practitionerId === userId) ||
                    (msg.userId === userId && msg.practitionerId === currentUserId)
                ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                return {
                    messages: messages,
                    unreadCount: 0,
                    otherUser: {
                        id: userId,
                        name: 'Practitioner',
                        email: '',
                        isPractitioner: true
                    }
                };
            }
        } catch (error) {
            console.error('Get conversation local error:', error);
            return {
                messages: [],
                unreadCount: 0,
                otherUser: {
                    id: userId,
                    name: 'Practitioner',
                    email: '',
                    isPractitioner: true
                }
            };
        }
    }

    // Mark message as read
    async markMessageAsRead(messageId) {
        try {
            const response = await fetch(`${this.baseURL}/${messageId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to mark message as read');
            }

            return await response.json();
        } catch (error) {
            console.error('Mark message as read error:', error);
            throw error;
        }
    }

    // Mark all messages in conversation as read
    async markAllMessagesAsRead(userId) {
        try {
            // First try backend API if available
            if (this.getAuthToken()) {
                const response = await fetch(`${this.baseURL}/conversation/${userId}/read-all`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.getAuthToken()}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    return await response.json();
                }
            }
            
            // Fallback to local storage system
            return this.markAllMessagesAsReadLocal(userId);
        } catch (error) {
            console.error('Mark all messages as read error:', error);
            // Fallback to local storage system
            return this.markAllMessagesAsReadLocal(userId);
        }
    }

    // Mark all messages as read using local storage
    markAllMessagesAsReadLocal(userId) {
        try {
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                throw new Error('User not authenticated');
            }

            // Use the shared data manager to mark messages as read
            if (window.cleartrackData && typeof cleartrackData.markMessagesAsRead === 'function') {
                cleartrackData.markMessagesAsRead(currentUserId, userId);
                return { success: true };
            } else {
                // Fallback: mark messages as read in localStorage
                const allMessages = JSON.parse(localStorage.getItem('cleartrack_messages') || '[]');
                const updatedMessages = allMessages.map(msg => {
                    if ((msg.userId === currentUserId && msg.practitionerId === userId) ||
                        (msg.userId === userId && msg.practitionerId === currentUserId)) {
                        return { ...msg, read: true };
                    }
                    return msg;
                });
                localStorage.setItem('cleartrack_messages', JSON.stringify(updatedMessages));
                return { success: true };
            }
        } catch (error) {
            console.error('Mark all messages as read local error:', error);
            return { success: false };
        }
    }

    // Delete a message
    async deleteMessage(messageId) {
        try {
            const response = await fetch(`${this.baseURL}/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete message');
            }

            return await response.json();
        } catch (error) {
            console.error('Delete message error:', error);
            throw error;
        }
    }

    // Get unread message count
    async getUnreadCount() {
        // Skip API calls when running from file:// protocol to prevent CORS errors
        if (window.location.protocol === 'file:') {
            console.log('🔄 Skipping API call - running from file:// protocol');
            return 0;
        }
        
        try {
            const response = await fetch(`${this.baseURL}/unread-count`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to get unread count');
            }

            const result = await response.json();
            return result.unreadCount;
        } catch (error) {
            console.error('Get unread count error:', error);
            return 0;
        }
    }

    // Start polling for new messages
    startMessagePolling() {
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
        }

        this.messagePollingInterval = setInterval(async () => {
            try {
                if (this.currentConversation) {
                    await this.refreshCurrentConversation();
                }
                await this.updateUnreadCount();
            } catch (error) {
                console.error('Message polling error:', error);
            }
        }, this.pollingInterval);
    }

    // Stop polling for messages
    stopMessagePolling() {
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
            this.messagePollingInterval = null;
        }
    }

    // Refresh current conversation
    async refreshCurrentConversation() {
        if (!this.currentConversation) return;

        try {
            const conversation = await this.getConversation(this.currentConversation);
            this.displayMessages(conversation.messages);
        } catch (error) {
            console.error('Refresh conversation error:', error);
        }
    }

    // Update unread count in UI
    async updateUnreadCount() {
        try {
            const unreadCount = await this.getUnreadCount();
            this.updateUnreadCountUI(unreadCount);
        } catch (error) {
            console.error('Update unread count error:', error);
        }
    }

    // Display messages in UI
    displayMessages(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Create message element
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        
        // Handle both API format and local storage format
        const isCurrentUser = (message.sender && message.sender._id === this.getCurrentUserId()) || 
                             (message.sender === 'user' && message.userId === this.getCurrentUserId());
        
        messageDiv.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
        
        // Get message content and timestamp based on format
        const content = message.content || message.text || '';
        const timestamp = message.createdAt || message.timestamp;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${message.replyTo ? this.createReplyElement(message.replyTo) : ''}
                ${message.attachments && message.attachments.length > 0 ? this.createAttachmentElement(message.attachments[0]) : ''}
                <div class="message-text">${this.escapeHtml(content)}</div>
                <div class="message-meta">
                    <span class="message-time">${this.formatTime(timestamp)}</span>
                    ${isCurrentUser ? this.createStatusIcon(message.status || 'sent') : ''}
                </div>
            </div>
        `;

        return messageDiv;
    }

    // Create reply element
    createReplyElement(replyTo) {
        return `
            <div class="message-reply">
                <div class="reply-content">${this.escapeHtml(replyTo.content)}</div>
                <div class="reply-author">${replyTo.sender.firstName} ${replyTo.sender.lastName}</div>
            </div>
        `;
    }

    // Create attachment element
    createAttachmentElement(attachment) {
        if (attachment.mimeType.startsWith('image/')) {
            return `
                <div class="message-attachment image">
                    <img src="/uploads/messages/${attachment.fileName}" alt="${attachment.originalName}" 
                         onclick="openImageModal('/uploads/messages/${attachment.fileName}', '${attachment.originalName}')">
                </div>
            `;
        } else if (attachment.mimeType === 'application/pdf') {
            return `
                <div class="message-attachment document pdf">
                    <div class="document-preview">
                        <div class="document-icon">📄</div>
                        <div class="document-info">
                            <div class="document-name">${attachment.originalName}</div>
                            <div class="document-size">${this.formatFileSize(attachment.fileSize)}</div>
                        </div>
                        <div class="document-actions">
                            <button onclick="openDocumentPreview('/uploads/messages/${attachment.fileName}', '${attachment.originalName}')" 
                                    class="preview-btn">Preview</button>
                            <button onclick="downloadFile('/uploads/messages/${attachment.fileName}', '${attachment.originalName}')" 
                                    class="download-btn">Download</button>
                        </div>
                    </div>
                </div>
            `;
        } else if (attachment.mimeType.includes('text/') || attachment.mimeType.includes('application/word') || attachment.mimeType.includes('application/vnd.openxmlformats')) {
            return `
                <div class="message-attachment document text">
                    <div class="document-preview">
                        <div class="document-icon">📝</div>
                        <div class="document-info">
                            <div class="document-name">${attachment.originalName}</div>
                            <div class="document-size">${this.formatFileSize(attachment.fileSize)}</div>
                        </div>
                        <div class="document-actions">
                            <button onclick="openDocumentPreview('/uploads/messages/${attachment.fileName}', '${attachment.originalName}')" 
                                    class="preview-btn">Preview</button>
                            <button onclick="downloadFile('/uploads/messages/${attachment.fileName}', '${attachment.originalName}')" 
                                    class="download-btn">Download</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="message-attachment document">
                    <div class="attachment-icon">📄</div>
                    <div class="attachment-info">
                        <div class="attachment-name">${attachment.originalName}</div>
                        <div class="attachment-size">${this.formatFileSize(attachment.fileSize)}</div>
                    </div>
                    <button onclick="downloadFile('/uploads/messages/${attachment.fileName}', '${attachment.originalName}')" 
                            class="download-btn">Download</button>
                </div>
            `;
        }
    }

    // Create status icon
    createStatusIcon(status) {
        const icons = {
            'sent': '✓',
            'delivered': '✓✓',
            'read': '✓✓'
        };
        return `<span class="message-status ${status}">${icons[status] || '✓'}</span>`;
    }

    // Update unread count in UI
    updateUnreadCountUI(count) {
        const unreadBadge = document.getElementById('unreadCount');
        if (unreadBadge) {
            unreadBadge.textContent = count;
            unreadBadge.style.display = count > 0 ? 'block' : 'none';
        }
    }

    // Document preview functionality
    openDocumentPreview(filePath, fileName) {
        const modal = document.createElement('div');
        modal.className = 'document-preview-modal';
        modal.innerHTML = `
            <div class="document-preview-overlay" onclick="closeDocumentPreview()">
                <div class="document-preview-container" onclick="event.stopPropagation()">
                    <div class="document-preview-header">
                        <h3>${fileName}</h3>
                        <button class="close-btn" onclick="closeDocumentPreview()">&times;</button>
                    </div>
                    <div class="document-preview-content">
                        <iframe src="${filePath}" width="100%" height="600px" frameborder="0"></iframe>
                    </div>
                    <div class="document-preview-footer">
                        <button onclick="downloadFile('${filePath}', '${fileName}')" class="download-btn">Download</button>
                        <button onclick="closeDocumentPreview()" class="close-btn">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add CSS if not already added
        if (!document.getElementById('document-preview-styles')) {
            const styles = document.createElement('style');
            styles.id = 'document-preview-styles';
            styles.textContent = `
                .document-preview-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                }
                
                .document-preview-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                }
                
                .document-preview-container {
                    background: white;
                    border-radius: 8px;
                    width: 100%;
                    max-width: 900px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                }
                
                .document-preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                
                .document-preview-header h3 {
                    margin: 0;
                    color: #374151;
                    font-size: 1.125rem;
                }
                
                .document-preview-content {
                    flex: 1;
                    overflow: hidden;
                }
                
                .document-preview-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                    padding: 1rem;
                    border-top: 1px solid #e5e7eb;
                }
                
                .close-btn {
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .download-btn {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    // Close document preview
    closeDocumentPreview() {
        const modal = document.querySelector('.document-preview-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Utility functions
    getAuthToken() {
        return localStorage.getItem('token');
    }

    getCurrentUserId() {
        // Try to get user from localStorage first
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
            return user.id;
        }
        
        // Try to get from global currentUser (user dashboard)
        if (window.currentUser && window.currentUser.id) {
            return window.currentUser.id;
        }
        
        // Try to get from cleartrackData if available
        if (window.cleartrackData && typeof cleartrackData.getCurrentUser === 'function') {
            const currentUser = cleartrackData.getCurrentUser();
            if (currentUser && currentUser.id) {
                return currentUser.id;
            }
        }
        
        // Check for practitioner authentication (for practitioner dashboard)
        if (window.practitioner && window.practitioner.id) {
            return window.practitioner.id;
        }
        
        // Check for practitioner in localStorage
        const storedPractitioner = JSON.parse(localStorage.getItem('current_practitioner') || '{}');
        if (storedPractitioner && storedPractitioner.id) {
            return storedPractitioner.id;
        }
        
        // Fallback: get from cleartrackData data structure
        if (window.cleartrackData && typeof cleartrackData.getData === 'function') {
            const data = cleartrackData.getData();
            
            // First try practitioners
            const practitionerIds = Object.keys(data.practitioners || {});
            if (practitionerIds.length > 0) {
                return practitionerIds[0]; // Return first practitioner ID
            }
            
            // Then try users
            const userIds = Object.keys(data.users || {});
            if (userIds.length > 0) {
                return userIds[0]; // Return first user ID
            }
        }
        
        // Final fallback: try to get from global currentUser variable
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
            return currentUser.id;
        }
        
        return null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 24 * 60 * 60 * 1000) { // Less than 24 hours
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Cleanup
    destroy() {
        this.stopMessagePolling();
    }
}

// Global messaging service instance
console.log('🚀 Creating MessagingService instance...');
window.messagingService = new MessagingService();
console.log('✅ MessagingService instance created:', window.messagingService);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOMContentLoaded - initializing messaging service...');
    if (window.messagingService) {
        window.messagingService.initialize();
        console.log('✅ MessagingService initialized');
    } else {
        console.error('❌ MessagingService not available during DOMContentLoaded');
    }
});
