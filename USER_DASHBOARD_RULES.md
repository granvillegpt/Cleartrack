# User Dashboard Rules & Structure Reference

## Purpose
This document serves as a reference to preserve the structure, functions, and patterns of the user (client) dashboard. Use this to maintain consistency when making changes.

---

## 1. FILE STRUCTURE

**File:** `public/user-dashboard.html`
- **Type:** Single-page application (SPA)
- **Dependencies:**
  - `global-styles.css`
  - `whatsapp-messaging.css`
  - `responsive-fixes.css`
  - `css/ct-theme.css`
  - `user-dashboard-styles.css`
  - `messaging-service.js`
  - `firebase-init.js`
  - `dashboard-auth.js`
  - `shared-data.js`
  - `firestore-data.js`

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
- Logout Button: `#desktopLogoutBtn`, `margin-left: auto`
- Navigation: Dashboard, Documents, Vehicles, Expenses, Messages, Connect, Profile

### 2.2 Main Sections (SPA Pattern)

All sections use the pattern: `<div id="sectionName" class="section hidden">`

**Available Sections:**
1. **`dashboard`** - Main dashboard with stats and quick actions
2. **`documents`** - Document upload and management
3. **`vehicles`** - Vehicle registration and management
4. **`expenses`** - Expense tracking and management
5. **`messages`** - WhatsApp-style messaging with practitioner
6. **`connect`** - Practitioner connection/onboarding
7. **`profile`** - User profile settings

**Section Pattern:**
- All sections have `class="section"`
- Hidden sections have `class="section hidden"`
- Only one section visible at a time
- Switching handled by `showSection(sectionName)`

### 2.3 Access Control

**Two Main Views:**
1. **Client Dashboard Main** (`#client-dashboard-main`) - Shown when practitioner is linked
2. **Onboarding View** (`#client-onboarding`) - Shown when no practitioner is linked

**Function:** `gateClientAccess(userDoc)` (line ~3263)
- Checks if user has `connectedPractitioner` or `practitionerId`
- Shows dashboard if linked, onboarding if not
- Redirects to onboarding page if needed

---

## 3. NAVIGATION SYSTEM

### 3.1 Navigation Links
```html
<a href="#" class="nav-link" onclick="handleNavClick('dashboard', event)">
```

**Function:** `handleNavClick(sectionName, event)` (line ~3495)
- Closes mobile menu
- Calls `showSection(sectionName)`
- Updates active nav link state

**Function:** `showSection(sectionName)` (line ~3467)
- Hides all sections (adds `hidden` class)
- Shows selected section (removes `hidden` class)
- Updates nav link active states
- Loads section-specific data:
  - `dashboard` → `updateDashboard()`
  - `messages` → `loadMessages()`
  - `connect` → `loadPractitionersDirectory()`

---

## 4. CORE STATE VARIABLES

```javascript
let currentUser = null;      // Current user object
let documents = [];          // Array of user documents
let vehicles = [];           // Array of user vehicles
let expenses = [];           // Array of user expenses
```

**Important:** These are global state variables. Always check for null/undefined before use.

---

## 5. INITIALIZATION FLOW

### 5.1 Page Load Sequence
1. **Firebase Initialization** (`firebase-init.js`)
2. **Authentication Check** (`dashboard-auth.js`)
3. **User Data Load:**
   ```javascript
   initializeUser() → loadUserFromFirestore() → gateClientAccess() → loadUserData()
   ```
4. **Practitioner Connection Listener:**
   ```javascript
   setupPractitionerIdListener(uid) // Watches for practitionerId changes
   ```

### 5.2 Key Initialization Functions

**`initializeUser()`** (line ~3062)
- Gets current user UID
- Attempts to load from Firestore
- Falls back to localStorage if Firestore fails
- Sets up practitioner ID listener

**`loadUserFromFirestore(uid)`** (line ~3133)
- Queries `users` collection
- Loads user data
- Syncs to localStorage for offline support
- Checks for practitioner connection

**`setupPractitionerIdListener(uid)`** (line ~3242)
- Sets up Firestore `onSnapshot` listener
- Watches for `practitionerId` or `connectedPractitioner` changes
- Reloads page when practitioner is linked

**`loadConnectionFromFirestore(uid)`** (line ~3293)
- Loads practitioner connection from Firestore
- Restores to localStorage
- Updates UI

---

## 6. DOCUMENT MANAGEMENT

### 6.1 Document Upload

**Function:** `showUploadModal()` (line ~3610)
- Shows document upload modal
- Supports drag-and-drop
- Supports file browser selection
- Supports camera scanner

**Function:** `handleFileUpload()` (line ~3654)
- Processes uploaded files
- Validates file types and sizes
- Saves to Firestore `users/{uid}/documents` collection
- Updates local `documents` array
- Refreshes document display

**Function:** `setupDragAndDrop()` (line ~3945)
- Sets up drag-and-drop handlers
- Highlights drop zone
- Prevents default browser behavior

**Function:** `openCameraScanner()` (line ~3771)
- Opens camera for document scanning
- Uses device camera API
- Processes scanned document

### 6.2 Document Display

**Function:** `updateDocumentsTable()` (line ~4060)
- Renders document list
- Shows document name, type, date
- Provides download/view actions
- Handles empty state

**Document Storage:**
- Firestore: `users/{uid}/documents/{docId}`
- Fields: `name`, `type`, `fileUrl`, `uploadedAt`, `size`

---

## 7. VEHICLE MANAGEMENT

### 7.1 Vehicle Functions

**Function:** `openVehiclesSection()` (line ~3591)
- Shows vehicles section
- Loads vehicle list

**Vehicle Storage:**
- Firestore: `users/{uid}/vehicles/{vehicleId}`
- Fields: `make`, `model`, `year`, `registration`, `vin`, etc.

---

## 8. EXPENSE MANAGEMENT

### 8.1 Expense Functions

**Function:** `openExpensesSection()` (line ~3595)
- Shows expenses section
- Loads expense list

**Function:** `updateDashboard()` (line ~3600)
- Updates expense counts
- Calculates total expenses
- Updates stat cards

**Expense Storage:**
- Firestore: `users/{uid}/expenses/{expenseId}`
- Fields: `description`, `amount`, `date`, `category`, `receiptUrl`, etc.

---

## 9. MESSAGING SYSTEM

### 9.1 Structure
- **Main Area:** Chat messages (`#messagesContainer`)
- **Input Area:** Message input (`#messageInputArea`)
- **Header:** Practitioner info (`#headerPractitionerName`, `#headerPractitionerAvatar`)

### 9.2 Key Functions

**`loadMessages()`**
- Loads messages between user and practitioner
- Updates message display
- Scrolls to bottom

**Messaging Integration:**
- Uses `messaging-service.js`
- Real-time updates via Firestore listeners
- WhatsApp-style interface

---

## 10. PRACTITIONER CONNECTION

### 10.1 Connection Flow

**Function:** `loadPractitionersDirectory()`
- Loads available practitioners
- Shows practitioner directory
- Allows user to connect via:
  - Practitioner code
  - Invite link
  - Questionnaire/matching

**Connection Methods:**
1. **Practitioner Code** - Enter code to connect
2. **Invite Link** - Use invite from practitioner
3. **Questionnaire** - Fill out form, system matches practitioner

**Function:** `setupPractitionerIdListener(uid)` (line ~3242)
- Watches for `practitionerId` changes
- Automatically reloads when practitioner is linked
- Updates UI to show dashboard

---

## 11. DASHBOARD STATISTICS

### 11.1 Update Function
**Function:** `updateDashboard()` (line ~3600)
- Updates all stat cards:
  - Document count: `#documentCount`
  - Vehicle count: `#vehicleCount`
  - Expense count: `#expenseCount`
  - Total expenses: `#totalExpenses`
- Calculates totals from arrays

### 11.2 Stat Cards
- **Documents Uploaded:** `#documentCount`
- **Vehicles Registered:** `#vehicleCount`
- **Expenses Recorded:** `#expenseCount`
- **Total Expenses:** `#totalExpenses`

---

## 12. CSS CLASSES & STYLING PATTERNS

### 12.1 Section Management
- **Visible:** `class="section"`
- **Hidden:** `class="section hidden"`
- **Active Nav:** `class="nav-link active"`

### 12.2 Card Pattern
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Title</h3>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
</div>
```

### 12.3 Stat Cards (Dashboard Tiles)
```html
<div class="stat-card clickable-tile" onclick="openDocumentsSection()">
  <div class="stat-value" id="documentCount">0</div>
  <div class="stat-label">Documents Uploaded</div>
</div>
```

**Card Types:**
- Default: `stat-card`
- Success: `stat-card success`
- Warning: `stat-card warning`
- Danger: `stat-card danger`

---

## 13. UTILITY FUNCTIONS

### 13.1 Error Handling

**Function:** `safeAsync(asyncFn, errorMessage, onError)` (line ~2884)
- Wraps async functions with error handling
- Shows user-friendly error messages
- Calls optional error callback

**Function:** `withTimeout(promise, timeoutMs, errorMessage)` (line ~3019)
- Adds timeout to promises
- Shows timeout error message
- Prevents hanging operations

### 13.2 User Notifications

**Function:** `showUserNotification(message, type, duration)` (line ~2904)
- Shows notification message
- Types: 'info', 'success', 'error', 'warning'
- Auto-dismisses after duration

### 13.3 Input Validation

**Function:** `sanitizeInput(input)` (line ~2947)
- Sanitizes user input
- Prevents XSS attacks
- Returns sanitized string

**Function:** `isValidEmail(email)` (line ~2959)
- Validates email format
- Returns boolean

**Function:** `isValidPhone(phone)` (line ~2969)
- Validates phone format
- Returns boolean

### 13.4 UI Helpers

**Function:** `setLoadingState(element, isLoading, loadingText)` (line ~2994)
- Shows/hides loading state
- Updates button text
- Disables/enables element

**Function:** `showConfirmation(message, title)` (line ~2981)
- Shows confirmation dialog
- Returns Promise<boolean>
- User-friendly confirmation

---

## 14. DATA INTEGRATION POINTS

### 14.1 Firestore Collections Used

1. **`users`**
   - User document: `users/{uid}`
   - Fields: `firstName`, `lastName`, `email`, `phone`, `connectedPractitioner`, `practitionerId`

2. **`users/{uid}/documents`**
   - User documents subcollection
   - Document metadata and file URLs

3. **`users/{uid}/vehicles`**
   - User vehicles subcollection
   - Vehicle registration data

4. **`users/{uid}/expenses`**
   - User expenses subcollection
   - Expense records and receipts

5. **`messages`**
   - Messages between user and practitioner
   - Real-time updates

6. **`connections`**
   - Active connections
   - Status tracking

### 14.2 Data Manager Usage

**`cleartrackData`** (from `shared-data.js`)
- `getUserDocuments(userId)` - Gets user documents
- `getUserExpenses(userId)` - Gets user expenses
- `getUserVehicles(userId)` - Gets user vehicles

**`firestoreData`** (from `firestore-data.js`)
- Used internally by `cleartrackData`
- Direct Firestore queries

---

## 15. REAL-TIME UPDATES

### 15.1 Practitioner Connection Listener
**Function:** `setupPractitionerIdListener(uid)` (line ~3242)
- Uses Firestore `onSnapshot` listener
- Watches `users/{uid}` document
- Triggers reload when `practitionerId` changes
- Automatic UI update when practitioner is linked

### 15.2 Message Updates
- Real-time message updates via `messaging-service.js`
- Firestore listeners for new messages
- Automatic UI refresh

---

## 16. ERROR HANDLING PATTERNS

### 16.1 Null Checks
```javascript
if (!currentUser) return;
if (!currentUser.id) return;
```

### 16.2 Try-Catch Blocks
```javascript
try {
  // Firestore operation
} catch (error) {
  console.error('Error message:', error);
  showUserNotification('Error message', 'error');
}
```

### 16.3 Fallback Patterns
```javascript
// Try Firestore first, fallback to localStorage
const data = await firestoreData.getData() || cleartrackData.getData();
```

---

## 17. MODAL PATTERNS

### 17.1 Modal Structure
```html
<div id="modalId" class="modal-overlay hidden">
  <div class="modal-content">
    <!-- Modal content -->
  </div>
</div>
```

### 17.2 Modal Functions
- **Show:** `modal.classList.remove('hidden')`
- **Hide:** `modal.classList.add('hidden')`
- **Toggle:** `modal.classList.toggle('hidden')`

### 17.3 Common Modals
- Document upload modal
- Vehicle registration modal
- Expense entry modal
- Profile edit modal

---

## 18. FORM HANDLING

### 18.1 File Upload Form
- Drag-and-drop support
- File browser selection
- Camera scanner option
- File type validation
- File size validation

### 18.2 Expense Form
- Date picker
- Category selection
- Amount input
- Description textarea
- Receipt upload

### 18.3 Vehicle Form
- Make/model inputs
- Year selection
- Registration number
- VIN number
- Other vehicle details

---

## 19. INTEGRATION WITH ADMIN DASHBOARD

### 19.1 Client Reassignment Impact
- When admin reassigns clients, user dashboard automatically updates
- `setupPractitionerIdListener()` detects `practitionerId` change
- Page reloads to show new practitioner
- Messages and data remain intact

### 19.2 Status Changes
- Practitioner status changes don't directly affect user dashboard
- User can still access dashboard
- Messaging may be affected if practitioner is suspended/deleted

---

## 20. BEST PRACTICES

### 20.1 Function Naming
- Use descriptive names: `loadUserFromFirestore()`, `updateDashboard()`
- Async functions: Prefix with `async`
- Event handlers: Use descriptive names

### 20.2 Code Organization
- Group related functions together
- Use comments to separate sections
- Keep functions focused (single responsibility)

### 20.3 Error Handling
- Always check for null/undefined
- Use try-catch for async operations
- Show user-friendly error messages
- Use `safeAsync()` wrapper for critical operations

### 20.4 Performance
- Use async/await properly
- Avoid unnecessary re-renders
- Cache data when possible
- Use Firestore listeners for real-time updates

---

## 21. COMMON PATTERNS

### 21.1 Loading Pattern
```javascript
async function loadData() {
  try {
    setLoadingState(element, true);
    const data = await getData();
    // Process data
    updateDisplay(data);
  } catch (error) {
    console.error('Error:', error);
    showUserNotification('Failed to load data', 'error');
  } finally {
    setLoadingState(element, false);
  }
}
```

### 21.2 Display Update Pattern
```javascript
function updateDisplay(data) {
  const container = document.getElementById('containerId');
  if (data.length === 0) {
    container.innerHTML = '<p>No data</p>';
    return;
  }
  container.innerHTML = data.map(item => renderItem(item)).join('');
}
```

### 21.3 Modal Pattern
```javascript
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('hidden');
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('hidden');
}
```

---

## 22. TESTING CHECKLIST

When modifying the user dashboard, verify:

- [ ] User loads correctly from Firestore
- [ ] Practitioner connection listener works
- [ ] Documents upload correctly
- [ ] Documents display correctly
- [ ] Vehicles add/display correctly
- [ ] Expenses add/display correctly
- [ ] Dashboard statistics update correctly
- [ ] Messages load and send correctly
- [ ] Navigation between sections works
- [ ] Mobile menu works
- [ ] File upload works (drag-drop, browser, camera)
- [ ] Forms submit correctly
- [ ] Error handling works
- [ ] Real-time updates work (practitioner connection)
- [ ] Access control works (onboarding vs dashboard)

---

## 23. VERSION HISTORY

**Last Updated:** Based on current codebase
**Key Features:**
- Document upload and management
- Vehicle registration
- Expense tracking
- Messaging with practitioner
- Practitioner connection
- Real-time updates
- Access control

---

## 24. NOTES

- User dashboard is a Single Page Application (SPA)
- Uses Firebase/Firestore for data storage
- Real-time updates via Firestore listeners
- Offline support via localStorage caching
- Mobile-responsive design
- Access control: Shows onboarding if no practitioner linked

---

**Use this document as a reference when:**
- Adding new user features
- Modifying existing functions
- Debugging issues
- Understanding data flow
- Maintaining consistency

