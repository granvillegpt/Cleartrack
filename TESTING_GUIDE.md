# Testing Guide - ClearTrack Practitioner Application Flow

## Issue: CORS Error When Testing Locally

If you're seeing a CORS error like:
```
Access to fetch at 'https://us-central1-cleartrack-1f6c6.cloudfunctions.net/...' 
from origin 'null' has been blocked by CORS policy
```

This happens because you're opening the HTML file directly in the browser (`file://` protocol). Firebase Cloud Functions require proper HTTP/HTTPS origins.

## Solutions

### Option 1: Use Firebase Hosting Emulator (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Start Firebase Hosting Emulator**:
   ```bash
   firebase emulators:start --only hosting
   ```

4. **Access your site**:
   - Open: `http://localhost:5000`
   - Navigate to: `http://localhost:5000/practitioner-application.html`

### Option 2: Use Python Simple HTTP Server

1. **Navigate to the public folder**:
   ```bash
   cd public
   ```

2. **Start a simple HTTP server**:
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Or Python 2
   python -m SimpleHTTPServer 8000
   ```

3. **Access your site**:
   - Open: `http://localhost:8000/practitioner-application.html`

### Option 3: Deploy to Firebase Hosting

1. **Deploy your site**:
   ```bash
   firebase deploy --only hosting
   ```

2. **Access your deployed site**:
   - Your site will be available at: `https://cleartrack-1f6c6.web.app` (or your custom domain)

## Testing the Complete Flow

### 1. Test Practitioner Application Submission

1. Navigate to the practitioner application form
2. Fill in all required fields:
   - First Name, Last Name
   - Email, Phone
   - Practice Name
   - Years of Experience
   - Qualifications
   - Select at least one Specialization
3. Click "Submit Application"
4. You should see: "Application submitted successfully!"

### 2. Test Admin Dashboard (Review Applications)

1. **Create an Admin User** (if not exists):
   - In Firebase Console → Firestore
   - Create/update a user document with `role: 'admin'`
   - Example:
     ```json
     {
       "email": "admin@cleartrack.co.za",
       "role": "admin",
       "name": "Admin User"
     }
     ```

2. **Login as Admin**:
   - Go to `/login.html`
   - Login with admin credentials
   - Should redirect to `/admin-dashboard.html`

3. **Review Applications**:
   - View pending applications
   - Click "Approve" to approve an application
   - Registration link will be sent via email

### 3. Test Practitioner Registration

1. **Get Registration Link**:
   - Check email for registration link (or get from admin dashboard)
   - Link format: `/practitioner-register.html?token=XXX&code=YYY`

2. **Complete Registration**:
   - Enter registration code
   - Set password (min 6 characters)
   - Click "Complete Registration"
   - Should redirect to practitioner dashboard

## Troubleshooting

### Error: "Cloud Function not found"
- **Solution**: Deploy Cloud Functions:
  ```bash
  cd functions
  npm install
  firebase deploy --only functions
  ```

### Error: "Failed to submit application"
- **Check**: Browser console for detailed error
- **Check**: Firebase Functions logs:
  ```bash
  firebase functions:log
  ```

### Error: "Access denied" on Admin Dashboard
- **Check**: User has `role: 'admin'` in Firestore
- **Check**: User is logged in

### Email Not Sending
- **Note**: Email sending is optional and won't block application submission
- **To enable**: Configure SendGrid or Mailgun in Firebase Functions config
- **For testing**: Check Firebase Functions logs for email attempts

## Firestore Security Rules

Ensure your Firestore rules allow:
- Creating practitioner applications (anyone)
- Reading applications (admin only)

Example rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Practitioner applications - anyone can create, admin can read
    match /practitionerApplications/{applicationId} {
      allow create: if true;
      allow read: if request.auth != null && 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Practitioner invites - admin can create, anyone can read with token
    match /practitionerInvites/{inviteId} {
      allow create: if request.auth != null && 
                       get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow read: if true; // Token-based access handled in function
    }
  }
}
```




