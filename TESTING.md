# ClearTrack Testing Documentation

## Overview
This document provides comprehensive testing scenarios and procedures for the ClearTrack registration and practitioner management system.

## Prerequisites

### 1. Environment Setup
- Firebase project configured
- Cloud Functions deployed
- Firestore database initialized
- Admin user created with `role: 'admin'` in Firestore

### 2. Service Configuration

#### Email Service (SendGrid or Mailgun)
```bash
# SendGrid
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY" sendgrid.from_email="noreply@cleartrack.co.za"

# OR Mailgun
firebase functions:config:set mailgun.api_key="YOUR_MAILGUN_API_KEY" mailgun.domain="your-domain.com" sendgrid.from_email="noreply@cleartrack.co.za"

# Admin email
firebase functions:config:set admin.email="admin@cleartrack.co.za"
```

#### SMS Service (Twilio)
```bash
firebase functions:config:set twilio.account_sid="YOUR_TWILIO_SID" twilio.auth_token="YOUR_TWILIO_TOKEN" twilio.phone_number="+1234567890"
```

#### Install Dependencies
```bash
cd functions
npm install
```

## Test Scenarios

### Scenario 1: Practitioner Application Flow

#### Step 1: Submit Application
1. Navigate to `https://app.cleartrack.co.za/practitioner-application.html`
2. Fill out the application form:
   - First Name: "John"
   - Last Name: "Doe"
   - Email: "john.doe@example.com"
   - Phone: "+27123456789"
   - Practice Name: "Doe Tax Services"
   - Years of Experience: "10"
   - Qualifications: "CA(SA), BCom Accounting"
   - Select at least one specialization
3. Click "Submit Application"
4. **Expected**: Success message displayed, form cleared

#### Step 2: Admin Receives Notification
1. Check admin email inbox
2. **Expected**: Email notification received with application details
3. **Expected**: Link to admin dashboard included

#### Step 3: Admin Reviews Application
1. Log in as admin user
2. Navigate to `https://app.cleartrack.co.za/admin-dashboard.html`
3. **Expected**: Application appears in "Pending" status
4. **Expected**: All application details visible
5. **Expected**: Stats show 1 pending application

#### Step 4: Admin Approves Application
1. Click "Approve" button on the application
2. Confirm approval
3. **Expected**: Application status changes to "Approved"
4. **Expected**: Stats update (0 pending, 1 approved)
5. **Expected**: Registration email sent to applicant

#### Step 5: Practitioner Receives Registration Link
1. Check applicant's email inbox
2. **Expected**: Email received with:
   - Registration link
   - 8-character registration code
   - 7-day expiration notice

#### Step 6: Practitioner Completes Registration
1. Click registration link in email
2. **Expected**: Redirected to `practitioner-register.html`
3. **Expected**: Email, name, and practice pre-filled
4. Enter registration code from email
5. Set password (minimum 6 characters)
6. Confirm password
7. Click "Complete Registration"
8. **Expected**: Success message
9. **Expected**: Auto-logged in
10. **Expected**: Redirected to practitioner dashboard

### Scenario 2: Client Registration - Practitioner Initiated

#### Step 1: Practitioner Adds Client
1. Log in as practitioner
2. Navigate to practitioner dashboard
3. Find "Add Client" section
4. Enter client details:
   - Mobile number: "+27987654321"
   - Client name (optional)
   - Note (optional)
5. Click "Send Invite"
6. **Expected**: Success message
7. **Expected**: SMS sent to client with:
   - 6-digit verification code
   - Registration link

#### Step 2: Client Receives SMS
1. Check client's mobile phone
2. **Expected**: SMS received with code and link

#### Step 3: Client Registers Account
1. Client clicks link or navigates to `login.html`
2. Click "Create Account" tab
3. Fill registration form:
   - First Name: "Jane"
   - Last Name: "Smith"
   - Email: "jane.smith@example.com"
   - Password: "password123"
   - Role: "I am a client/user" (default)
4. Click "Create Account"
5. **Expected**: Account created
6. **Expected**: Redirected to `client-onboarding.html`

#### Step 4: Client Verifies Invite Code
1. On onboarding page, find "Have an invite code?" section
2. Enter mobile number: "+27987654321"
3. Enter verification code from SMS
4. Click "Connect"
5. **Expected**: Success message
6. **Expected**: Linked to practitioner
7. **Expected**: Redirected to user dashboard

### Scenario 3: Client Registration - Client Initiated

#### Step 1: Client Registers Account
1. Navigate to `login.html`
2. Click "Create Account" tab
3. Fill registration form (same as Scenario 2, Step 3)
4. Click "Create Account"
5. **Expected**: Redirected to `client-onboarding.html`

#### Step 2: Client Completes Questionnaire
1. On onboarding page, find "New to ClearTrack?" section
2. Select relevant specializations:
   - Individual Tax Returns
   - Small Business Tax
   - etc.
3. Optionally add a message
4. Click "Send Request"
5. **Expected**: Success message
6. **Expected**: Request created and assigned to matching practitioner

#### Step 3: Practitioner Receives Request
1. Log in as practitioner
2. Navigate to practitioner dashboard
3. Find "Client Requests" section
4. **Expected**: Request visible with client details
5. **Expected**: Client's selected specializations displayed

#### Step 4: Practitioner Accepts Request
1. Click "Accept" on the request
2. **Expected**: Request status changes to "Accepted"
3. **Expected**: Client linked to practitioner
4. **Expected**: Client redirected to dashboard (if logged in)

#### Step 5: Practitioner Declines Request (Alternative)
1. Click "Decline" on the request
2. Confirm decline
3. **Expected**: Request reassigned to next practitioner in rotation
4. **Expected**: Original practitioner removed from rotation

### Scenario 4: Admin Dashboard Features

#### Test Filtering
1. Log in as admin
2. Navigate to admin dashboard
3. **Expected**: All applications visible
4. Select "Pending" from status filter
5. **Expected**: Only pending applications shown
6. Enter search term in search box
7. **Expected**: Applications filtered by name/email/practice

#### Test Statistics
1. View stats cards at top of dashboard
2. **Expected**: Accurate counts for:
   - Pending applications
   - Approved applications
   - Rejected applications
   - Total applications

#### Test Rejection
1. Find a pending application
2. Click "Reject"
3. Confirm rejection
4. **Expected**: Application status changes to "Rejected"
5. **Expected**: Stats update accordingly

## Edge Cases & Error Handling

### Test 1: Expired Registration Link
1. Wait 7+ days after approval (or manually expire in database)
2. Click registration link
3. **Expected**: Error message: "Registration link has expired"
4. **Expected**: Contact support message

### Test 2: Invalid Registration Code
1. Use valid registration link
2. Enter incorrect code
3. **Expected**: Error message: "Invalid registration code"

### Test 3: Duplicate Email Registration
1. Try to complete registration with email that already exists
2. **Expected**: Error message: "An account with this email already exists"

### Test 4: Missing Required Fields
1. Try to submit practitioner application without required fields
2. **Expected**: Validation errors displayed
3. **Expected**: Form submission prevented

### Test 5: No Specializations Selected
1. Try to submit client request without selecting specializations
2. **Expected**: Error message: "Please select at least one option"

### Test 6: SMS Service Not Configured
1. Remove Twilio credentials
2. Practitioner adds client
3. **Expected**: Invite created successfully
4. **Expected**: Warning logged (SMS not sent)
5. **Expected**: Code still available in system for manual sharing

### Test 7: Email Service Not Configured
1. Remove email service credentials
2. Admin approves application
3. **Expected**: Application approved
4. **Expected**: Warning logged (email not sent)
5. **Expected**: Registration link available in admin dashboard

## Performance Testing

### Test 1: Multiple Concurrent Applications
1. Submit 10+ practitioner applications simultaneously
2. **Expected**: All applications processed
3. **Expected**: No data loss
4. **Expected**: Admin dashboard shows all applications

### Test 2: Large Application List
1. Create 50+ applications
2. Load admin dashboard
3. **Expected**: Dashboard loads within 3 seconds
4. **Expected**: Filtering/search works smoothly

## Security Testing

### Test 1: Unauthorized Access
1. Try to access admin dashboard without admin role
2. **Expected**: Redirected to login
3. **Expected**: Access denied message

### Test 2: Role-Based Access
1. Log in as client, try to access practitioner dashboard
2. **Expected**: Redirected to user dashboard
3. Log in as practitioner, try to access admin dashboard
4. **Expected**: Access denied

### Test 3: Token Validation
1. Try to use expired registration token
2. **Expected**: Error message
3. Try to use already-used token
4. **Expected**: Error message

## Integration Testing

### Test 1: Complete Practitioner Flow
- Run Scenario 1 end-to-end
- **Expected**: All steps complete successfully
- **Expected**: Practitioner can log in and access dashboard

### Test 2: Complete Client Flow (Practitioner Initiated)
- Run Scenario 2 end-to-end
- **Expected**: Client linked to practitioner
- **Expected**: Both can see each other in dashboards

### Test 3: Complete Client Flow (Client Initiated)
- Run Scenario 3 end-to-end
- **Expected**: Client matched with practitioner
- **Expected**: Connection established

## Manual Testing Checklist

- [ ] Practitioner application form submission
- [ ] Admin email notification received
- [ ] Admin dashboard displays applications
- [ ] Admin can approve application
- [ ] Practitioner receives registration email
- [ ] Practitioner can complete registration
- [ ] Practitioner can log in
- [ ] Practitioner can add client
- [ ] Client receives SMS
- [ ] Client can register account
- [ ] Client can verify invite code
- [ ] Client can complete questionnaire
- [ ] Practitioner receives client request
- [ ] Practitioner can accept/decline request
- [ ] Rotation system works on decline
- [ ] All error cases handled properly
- [ ] All redirects work correctly
- [ ] Role-based access control works

## Automated Testing (Future)

Consider implementing:
- Unit tests for Cloud Functions
- Integration tests for complete flows
- E2E tests using Playwright/Cypress
- Load testing for concurrent users

## Troubleshooting

### Issue: Emails not sending
- Check SendGrid/Mailgun API keys configured
- Verify sender email is verified in service
- Check Cloud Functions logs for errors

### Issue: SMS not sending
- Check Twilio credentials configured
- Verify phone number format (+country code)
- Check Twilio account has credits
- Review Cloud Functions logs

### Issue: Admin dashboard not loading
- Verify user has `role: 'admin'` in Firestore
- Check browser console for errors
- Verify Firestore security rules allow read access

### Issue: Registration link not working
- Check token exists in `practitionerInvites` collection
- Verify link hasn't expired
- Check code matches exactly (case-sensitive)

## Notes

- All timestamps use Firestore Timestamp format
- Registration codes are case-insensitive (converted to uppercase)
- Mobile numbers should include country code
- Email addresses are case-insensitive
- Passwords minimum 6 characters

