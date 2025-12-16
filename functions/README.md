# Cloud Functions for ClearTrack

## Status: Prepared for Future Implementation

This directory contains Firebase Cloud Functions that are **prepared but not currently deployed**.

### Current Status
- ✅ Functions code is complete and ready
- ✅ Dependencies are configured in `package.json`
- ⏸️ **Not deployed** (requires Blaze plan)
- 📝 Ready for deployment when needed

### Functions Included

1. **Client Invite Management**
   - `createClientInvite` - Creates invite links for clients
   - `verifyClientInvite` - Verifies and processes invite links
   - `getClientInvites` - Retrieves invites for a practitioner

2. **Client Request Management**
   - `createClientRequest` - Creates connection requests
   - `getClientRequests` - Retrieves requests for practitioners
   - `updateClientRequestStatus` - Updates request status

3. **Email Notifications** (when SendGrid is configured)
   - Email sending functionality for invites and notifications

### Deployment Instructions

When ready to deploy (after upgrading to Blaze plan):

1. **Install dependencies:**
   ```bash
   cd functions
   npm install
   ```

2. **Configure environment variables (if needed):**
   ```bash
   firebase functions:config:set sendgrid.apikey="YOUR_API_KEY"
   ```

3. **Deploy functions:**
   ```bash
   firebase deploy --only functions
   ```

### Notes
- Functions are designed to work alongside the localStorage-based system
- The app currently uses localStorage for all operations
- Functions will enhance the system when deployed but are not required for current functionality

