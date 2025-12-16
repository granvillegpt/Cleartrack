# Admin Dashboard Rules & Structure Reference

## Purpose
This document serves as a reference to preserve the structure, functions, and patterns of the admin dashboard. Use this to maintain consistency when making changes.

---

## 1. FILE STRUCTURE

**File:** `public/admin-dashboard.html`
- **Type:** Single-page application (SPA)
- **Dependencies:**
  - `global-styles.css`
  - `whatsapp-messaging.css`
  - `responsive-fixes.css`
  - `css/ct-theme.css`
  - `firebase-init.js`
  - `dashboard-auth.js`

---

## 2. HTML STRUCTURE

### 2.1 Header Section
```html
<header class="header">
  <div class="header-top">
    <!-- Mobile menu toggle -->
    <!-- Logo (centered) -->
    <!-- Logout button (right-aligned) -->
  </div>
  <nav class="nav nav-style6" id="mainNav">
    <!-- Navigation links -->
  </nav>
</header>
```

**Key Elements:**
- Mobile Menu Toggle: `#menuToggle`, calls `toggleMenuStyle6()`
- Logo: Centered, absolute positioning with `transform: translateX(-50%)`
- Logout Button: `#desktopLogoutBtn`, `margin-left: auto`, `onclick="window.location.href='/login.html'"`
- Navigation: Three tabs - Applications, Practitioners, Users

### 2.2 Main Content Structure

**No Section-Based Navigation** - Admin dashboard uses a single-page view with filters and tabs

**Main Sections:**
1. **Applications View** - Default view, shows practitioner applications
2. **Practitioners View** - Shows approved practitioners (via filter)
3. **Users View** - Shows all users (via filter)

**Note:** Unlike practitioner/user dashboards, admin dashboard doesn't use `showSection()` pattern. It uses filtering and rendering instead.

---

## 3. NAVIGATION SYSTEM

### 3.1 Navigation Links
```html
<a href="#" class="nav-link active" onclick="handleNavClick('applications', event)">Applications</a>
<a href="#" class="nav-link" onclick="handleNavClick('practitioners', event)">Practitioners</a>
<a href="#" class="nav-link" onclick="handleNavClick('users', event)">Users</a>
```

**Function:** `handleNavClick(sectionName, event)`
- Updates active nav link state
- Currently navigation is visual only - filtering happens via `renderApplications()`

### 3.2 Mobile Menu
**Function:** `toggleMenuStyle6()` (line ~2507)
- Toggles mobile navigation menu
- Uses `#menuToggle` and `#mainNav` elements
- Closes on outside click or Escape key

---

## 4. CORE STATE VARIABLES

```javascript
let allApplications = [];  // All practitioner applications loaded from Firestore
```

**Important:** Applications are loaded once and filtered/rendered client-side.

---

## 5. INITIALIZATION FLOW

### 5.1 Page Load Sequence
1. **Firebase Initialization** (`firebase-init.js`)
2. **Authentication Check** (`dashboard-auth.js`)
3. **Admin Dashboard Initialization:**
   ```javascript
   initializeAdminDashboard() → loadApplications() → renderApplications()
   ```

### 5.2 Key Initialization Functions

**`initializeAdminDashboard()`** (line ~1627)
- Verifies admin role
- Checks Firebase Auth current user
- Returns success/failure

**`loadApplications()`** (line ~1686)
- Loads all applications from `practitionerApplications` collection
- Fetches additional data:
  - User status from `users` collection (for approved apps)
  - Client count for approved practitioners
  - Fraud status flags
- Updates `allApplications` array
- Calls `updateStats()` and `renderApplications()`

---

## 6. APPLICATION MANAGEMENT

### 6.1 Loading Applications

**Function:** `loadApplications()` (line ~1686)
```javascript
async function loadApplications() {
  const snapshot = await window.firebaseDb.collection('practitionerApplications').get();
  allApplications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Fetch additional data for approved applications
  // Update stats and render
}
```

**Data Source:** Firestore `practitionerApplications` collection

### 6.2 Rendering Applications

**Function:** `renderApplications()` (line ~1891)
- Filters applications based on:
  - Status filter dropdown
  - Search filter (name, email, practice name)
- Renders application cards with:
  - Application details
  - Status badges
  - Action buttons (Approve, Reject, Suspend, Delete, Tag as Fraud, Clear Fraud)
  - Expandable details section

**Filter Options:**
- All
- Pending
- Approved
- Suspended
- Rejected
- Fraud

### 6.3 Application Actions

**`approveApplication(applicationId)`** (line ~2224)
- Generates unique practitioner code
- Updates application status to 'approved'
- Creates/updates user document in `users` collection
- Sends password reset email
- Reloads applications

**`rejectApplication(applicationId)`** (line ~2362)
- Updates application status to 'rejected'
- Reloads applications
- **Note:** No email sent to practitioner

**`suspendPractitionerByEmail(email)`** (line ~2465)
- Finds user by email
- Updates `practitionerStatus: 'suspended'`
- **Important:** Does NOT reassign clients

**`reactivatePractitionerByEmail(email)`** (line ~2529)
- Finds user by email
- Updates `practitionerStatus: 'approved'`
- Updates application status

**`deletePractitioner(email)`** (line ~3152)
- **Confirmation required**
- Reassigns clients to matching practitioners
- Updates user status to 'deleted'
- Updates application status

**`tagPractitionerAsFraud(email)`** (line ~3262)
- Sets `practitionerStatus: 'fraud'`
- Sets `fraudTagged: true`
- Sets `fraudAppealDeadline` (30 days from now)
- **Important:** Does NOT immediately reassign clients

**`clearFraudTag(email)`** (line ~3359)
- Removes fraud status
- Restores to 'approved'
- Clears fraud flags

---

## 7. CLIENT REASSIGNMENT SYSTEM

### 7.1 Reassignment Functions

**`reassignClientsToNewPractitioners(practitionerId, reason)`** (line ~2645)
- Finds all clients connected to practitioner
- Reassigns each client to matching practitioner
- Updates `users` and `connections` collections
- Returns results summary

**`findMatchingPractitioner(clientNeeds, excludedPractitionerId)`** (line ~2564)
- Finds active practitioner with matching specializations
- Uses rotation index for load balancing
- Returns practitioner ID or null

**`reassignClientsFromFraudTaggedPractitioners()`** (line ~2834)
- Shows modal with fraud-tagged practitioners past appeal deadline
- Admin selects which practitioners to process
- Reassigns clients for selected practitioners

### 7.2 Reassignment Process
1. Find clients via `users` and `connections` collections
2. Get client specializations from `clientRequests`
3. Find matching practitioner via `findMatchingPractitioner()`
4. Update `users` collection: `connectedPractitioner` → new practitioner ID
5. Update `connections` collection: mark old as 'reassigned', create new 'active'
6. Store audit trail: `previousPractitioner`, `reassignedAt`, `reassignedReason`

---

## 8. STATISTICS & FILTERING

### 8.1 Statistics

**Function:** `updateStats()` (line ~1869)
- Calculates counts:
  - Pending applications
  - Approved applications (excluding fraud)
  - Suspended practitioners
  - Rejected applications
  - Fraud-tagged practitioners
  - Total applications
- Updates stat cards in header

### 8.2 Filtering

**Function:** `setupFilters()` (line ~2406)
- Sets up status filter dropdown
- Sets up search input
- Custom dropdown for mobile
- Calls `renderApplications()` on change

**Filter Elements:**
- Status dropdown: `#filterStatus`
- Search input: `#filterSearch`
- Custom mobile dropdown: `.custom-select`

---

## 9. PRACTITIONER CODE GENERATION

**Function:** `generateUniquePractitionerCode()` (line ~2180)
- Generates 8-character code
- Characters: A-Z, 2-9 (excludes 0, O, I, 1)
- Checks Firestore for uniqueness
- Retries up to 10 times if code exists
- Returns unique code

**Format:** 8 characters, alphanumeric (no confusing characters)

---

## 10. EVENT DELEGATION

**Function:** `setupApplicationEventDelegation()` (line ~2081)
- Sets up event delegation for application action buttons
- Handles click and touchend events
- Routes to appropriate action functions:
  - `approve` → `approveApplication()`
  - `reject` → `rejectApplication()`
  - `suspend` → `suspendPractitionerByEmail()`
  - `reactivate` → `reactivatePractitionerByEmail()`
  - `delete` → `deletePractitioner()`
  - `fraud` → `tagPractitionerAsFraud()`
  - `clear-fraud` → `clearFraudTag()`
  - `toggle` → `toggleApplicationDetails()`

**Why Event Delegation:** Applications are dynamically rendered, so direct event listeners won't work.

---

## 11. APPLICATION DETAILS

**Function:** `toggleApplicationDetails(appId)` (line ~2387)
- Toggles expandable details section
- Shows/hides application information:
  - Name, Email, Phone
  - Practice Name, Practice Number, SARS Number
  - Experience, Qualifications
  - Specializations, Bio
  - Created Date

---

## 12. CSS CLASSES & STYLING PATTERNS

### 12.1 Application Cards
```html
<div class="application-item">
  <div class="application-header">
    <div class="application-info">
      <!-- Practitioner info -->
    </div>
    <span class="application-status status-{status}">{Status}</span>
  </div>
  <div class="application-actions">
    <!-- Action buttons -->
  </div>
</div>
```

### 12.2 Status Badges
- `status-pending` - Yellow/orange
- `status-approved` - Green
- `status-rejected` - Red
- `status-suspended` - Orange
- `status-fraud` - Red background, light red text

### 12.3 Action Buttons
- `.btn-primary` - Approve, Reactivate
- `.btn-danger` - Reject, Suspend, Delete
- `.btn-fraud` - Tag as Fraud
- `.btn-clear-fraud` - Clear Fraud Tag
- `.btn-secondary` - Reassign Fraud Clients

---

## 13. ALERT SYSTEM

**Function:** `showAlert(message, type)` (line ~1677)
- Shows alert message at top of page
- Types: 'success', 'error', 'warning', 'info'
- Auto-dismisses after delay
- Element: `#alert`

---

## 14. DATA COLLECTIONS USED

### 14.1 Firestore Collections

1. **`practitionerApplications`**
   - All practitioner applications
   - Status: pending, approved, rejected, deleted, fraud

2. **`users`**
   - Practitioner user documents
   - Client user documents (for reassignment)
   - Fields: `practitionerStatus`, `practitionerCode`, `fraudTagged`, etc.

3. **`connections`**
   - Active client-practitioner connections
   - Status: active, disconnected, reassigned

4. **`clientRequests`**
   - Client requests with specializations
   - Used for matching during reassignment

---

## 15. INTEGRATION WITH PRACTITIONER DASHBOARD

### 15.1 Status Changes Impact
- When admin changes practitioner status, practitioner dashboard reflects changes
- Practitioner dashboard queries Firestore directly
- Changes appear within 2 seconds (polling interval)

### 15.2 Client Reassignment Impact
- When admin reassigns clients, practitioner dashboard automatically updates
- Old practitioner: Clients disappear from list
- New practitioner: Clients appear in list
- No manual refresh needed

---

## 16. MODAL PATTERNS

### 16.1 Reassignment Modal
**Function:** `reassignClientsFromFraudTaggedPractitioners()` creates modal
- Shows list of fraud-tagged practitioners
- Checkboxes for selection
- Cancel and Confirm buttons
- Processes selected practitioners

### 16.2 Confirmation Dialogs
- Uses browser `confirm()` for critical actions
- Delete: "Are you sure you want to permanently delete this practitioner?"
- Suspend: "Are you sure you want to suspend this practitioner?"
- Reject: "Are you sure you want to reject this application?"

---

## 17. BEST PRACTICES

### 17.1 Function Naming
- Use descriptive names: `approveApplication()`, `reassignClientsToNewPractitioners()`
- Async functions: Prefix with `async`
- Action functions: Use verb + noun pattern

### 17.2 Error Handling
- Always use try-catch for async operations
- Show user-friendly error messages via `showAlert()`
- Log errors to console for debugging

### 17.3 Data Loading
- Load applications once on page load
- Filter/render client-side for performance
- Reload after actions that change data

### 17.4 Confirmation Patterns
- Always confirm destructive actions (delete, reject)
- Show clear consequences in confirmation messages
- Use browser `confirm()` for simplicity

---

## 18. COMMON PATTERNS

### 18.1 Action Button Pattern
```javascript
<button 
  class="btn btn-primary" 
  data-action="approve" 
  data-app-id="${appId}" 
  onclick="event.stopPropagation(); approveApplication('${appId}'); return false;">
  Approve
</button>
```

### 18.2 Status Filter Pattern
```javascript
if (statusFilter === 'approved') {
  filtered = filtered.filter(a => {
    const isApproved = a.status === 'approved';
    return isApproved && a.userPractitionerStatus !== 'suspended' && a.userPractitionerStatus !== 'fraud';
  });
}
```

### 18.3 Email Finding Pattern
```javascript
// Try exact match
let snapshot = await db.collection('users')
  .where('email', '==', email)
  .limit(1)
  .get();

// Try trimmed
if (snapshot.empty) {
  snapshot = await db.collection('users')
    .where('email', '==', email.trim())
    .limit(1)
    .get();
}

// Try lowercase
if (snapshot.empty) {
  snapshot = await db.collection('users')
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();
}
```

---

## 19. TESTING CHECKLIST

When modifying the admin dashboard, verify:

- [ ] Applications load correctly
- [ ] Filters work (status and search)
- [ ] Statistics update correctly
- [ ] Approve creates practitioner code and user document
- [ ] Reject updates status
- [ ] Suspend/reactivate work
- [ ] Delete reassigns clients
- [ ] Tag as fraud sets grace period
- [ ] Clear fraud tag works
- [ ] Reassignment modal works
- [ ] Client reassignment finds matching practitioners
- [ ] Event delegation works for action buttons
- [ ] Mobile menu works
- [ ] Alerts display correctly

---

## 20. VERSION HISTORY

**Last Updated:** Based on current codebase
**Key Features:**
- Application approval/rejection
- Practitioner management (suspend/reactivate/delete)
- Fraud management (tag/clear)
- Client reassignment system
- Statistics dashboard
- Filtering and search

---

## 21. NOTES

- Admin dashboard is a Single Page Application (SPA)
- Uses client-side filtering (no server-side pagination)
- All applications loaded at once
- Real-time updates via Firestore queries
- Mobile-responsive design
- Event delegation for dynamic content

---

**Use this document as a reference when:**
- Adding new admin features
- Modifying application management
- Debugging issues
- Understanding data flow
- Maintaining consistency

