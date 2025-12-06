# Practitioner Dashboard Rules & Structure Reference

## Purpose
This document serves as a reference to preserve the structure, functions, and patterns of the practitioner dashboard. Use this to maintain consistency when making changes.

---

## 1. FILE STRUCTURE

**File:** `public/practitioner-dashboard.html`
- **Type:** Single-page application (SPA)
- **Dependencies:**
  - `global-styles.css`
  - `whatsapp-messaging.css`
  - `responsive-fixes.css`
  - `css/ct-theme.css`
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
    <!-- Logo (centered) -->
    <!-- Logout button (right-aligned) -->
  </div>
  <nav class="nav">
    <!-- Navigation links -->
  </nav>
</header>
```

**Key Elements:**
- Logo: Centered, absolute positioning with `transform: translateX(-50%)`
- Logout Button: `#desktopLogoutBtn`, `margin-left: auto`
- Navigation: Flexbox, centered, with active state management

### 2.2 Main Sections (SPA Pattern)

All sections use the pattern: `<div id="sectionName" class="section hidden">`

**Available Sections:**
1. **`dashboard`** - Main dashboard with stats and client list
2. **`clients`** - Client management section
3. **`messages`** - WhatsApp-style messaging interface
4. **`requests`** - Connection requests management
5. **`tax-returns`** - Tax return management
6. **`invoices`** - Invoice management
7. **`profile`** - Practitioner profile settings

**Section Pattern:**
- All sections have `class="section"`
- Hidden sections have `class="section hidden"`
- Only one section visible at a time
- Switching handled by `showSection(sectionName)`

---

## 3. NAVIGATION SYSTEM

### 3.1 Navigation Links
```html
<a href="#" class="nav-link" onclick="handleNavClick('dashboard', event)">
```

**Function:** `handleNavClick(sectionName, event)`
- Closes mobile menu
- Calls `showSection(sectionName)`
- Updates active nav link state

**Function:** `showSection(sectionName)`
- Hides all sections (adds `hidden` class)
- Shows selected section (removes `hidden` class)
- Updates nav link active states
- Loads section-specific data:
  - `dashboard` → `updateDashboard()`
  - `clients` → `loadClients()`
  - `tax-returns` → `loadTaxReturns()`
  - `messages` → `loadConversations()`
  - `requests` → `loadConnectionRequests()`
  - `invoices` → `loadInvoices()`

---

## 4. CORE STATE VARIABLES

```javascript
let practitioner = null;        // Current practitioner object
let clients = [];               // Array of connected clients
let taxReturns = [];            // Array of tax returns
let currentClientId = null;     // Currently selected client ID
```

**Important:** These are global state variables. Always check for null/undefined before use.

---

## 5. INITIALIZATION FLOW

### 5.1 Page Load Sequence
1. **Firebase Initialization** (`firebase-init.js`)
2. **Authentication Check** (`dashboard-auth.js`)
3. **Practitioner Data Load:**
   ```javascript
   initializePractitioner() → loadPractitionerFromFirestore() → updatePractitionerInterface()
   ```
4. **Initial Data Load:**
   - `loadClients()`
   - `loadTaxReturns()`
   - `loadInvoices()`
   - `updateDashboard()`

### 5.2 Key Initialization Functions

**`initializePractitioner()`** (line ~3067)
- Gets current user UID
- Attempts to load from Firestore
- Falls back to localStorage if Firestore fails
- Creates practitioner document if doesn't exist

**`loadPractitionerFromFirestore(uid)`** (line ~3104)
- Queries `users` collection where `role == 'practitioner'`
- Loads practitioner data
- Syncs to localStorage for offline support

**`createPractitionerInFirestore(uid)`** (line ~3202)
- Creates new practitioner document
- Sets default values
- Initializes `rotationIndex: 0`

---

## 6. CLIENT MANAGEMENT

### 6.1 Loading Clients

**Function:** `loadClients()` (line ~6452)
```javascript
async function loadClients() {
  if (!practitioner) return;
  
  clients = await cleartrackData.getConnectedUsers(practitioner.id);
  
  // Calculate document and expense counts
  clients.forEach(client => {
    // ... calculate counts
  });
  
  updateClientsDisplay();
  setupClientSearch();
}
```

**CRITICAL:** Must be `async` and `await` `getConnectedUsers()` - it returns a Promise!

**Data Source:** `cleartrackData.getConnectedUsers(practitionerId)`
- Queries Firestore `users` collection
- Filters: `where('connectedPractitioner', '==', practitionerId)`
- Returns array of client objects

### 6.2 Client Display

**Function:** `updateClientsDisplay(clientList)` (line ~6739)
- Renders client cards
- Shows document/expense counts
- Handles empty state
- Updates client count badge

**Function:** `loadConversations()` (line ~8884)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`
- Loads clients for messaging interface
- Updates conversations list
- Called every 2 seconds via polling

### 6.3 Client Modals

**`showClientsModal()`** (line ~3680)
- Shows all connected clients
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`

**`showActiveClientsModal()`** (line ~3721)
- Shows only active clients (with documents/expenses)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`

---

## 7. MESSAGING SYSTEM

### 7.1 Structure
- **Sidebar:** Client list (`#conversationsList`)
- **Main Area:** Chat messages (`#conversationMessages`)
- **Input Area:** Message input (`#messageInputArea`)

### 7.2 Key Functions

**`loadConversations()`** (line ~8884)
- Loads client list for sidebar
- Updates every 2 seconds (polling)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`

**`loadPractitionerMessages(clientId)`**
- Loads messages for specific client
- Updates message display

**Polling System:**
```javascript
setInterval(function() {
  if (window.practitioner && window.loadConversations) {
    window.loadConversations();
    if (window.currentConversationClient && window.loadPractitionerMessages) {
      window.loadPractitionerMessages();
    }
  }
}, 2000); // Every 2 seconds
```

---

## 8. INVOICE MANAGEMENT

### 8.1 Invoice Functions

**`generateInvoice(returnId)`** (line ~3905)
- Creates invoice from tax return
- Generates invoice number
- Opens invoice preview modal

**`sendInvoiceViaChat()`** (line ~4066)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`
- Sends invoice via messaging system
- Finds client by name matching

**`sendInvoiceViaEmail()`** (line ~4148)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`
- Opens email client with invoice
- Finds client email by name matching

**`emailInvoice(invoiceId)`** (line ~5642)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`
- Finds invoice and client
- Opens email client

**`chatInvoice(invoiceId)`** (line ~5717)
- **CRITICAL:** Must be `async` and `await` `getConnectedUsers()`
- Sends invoice via chat
- Finds client by name matching

### 8.2 Invoice Number Generation

**`generateInvoiceNumber()`** (line ~4018)
- Format: `INV-YYYY-XXXXXX`
- Year + 6-digit sequential number
- Checks for uniqueness

---

## 9. TAX RETURN MANAGEMENT

### 9.1 Tax Return Functions

**`loadTaxReturns()`**
- Loads all tax returns for practitioner
- Filters by practitioner ID
- Updates display

**`markTaxReturnCompleted(returnId)`** (line ~3859)
- Marks return as completed
- Updates status in Firestore
- Refreshes display

---

## 10. CSS CLASSES & STYLING PATTERNS

### 10.1 Section Management
- **Visible:** `class="section"`
- **Hidden:** `class="section hidden"`
- **Active Nav:** `class="nav-link active"`

### 10.2 Card Pattern
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

### 10.3 Stat Cards (Dashboard Tiles)
```html
<div class="stat-card clickable-tile" onclick="functionName()">
  <div class="stat-value" id="statId">0</div>
  <div class="stat-label">Label</div>
  <div class="tile-hint">Hint text</div>
</div>
```

**Card Types:**
- Default: `stat-card`
- Success: `stat-card success`
- Warning: `stat-card warning`
- Danger: `stat-card danger`

---

## 11. ASYNC/AWAIT REQUIREMENTS

### ⚠️ CRITICAL: Functions That MUST Be Async

These functions call `getConnectedUsers()` which returns a Promise:

1. ✅ `loadClients()` - Must be `async`, must `await`
2. ✅ `loadConversations()` - Must be `async`, must `await`
3. ✅ `showClientsModal()` - Must be `async`, must `await`
4. ✅ `showActiveClientsModal()` - Must be `async`, must `await`
5. ✅ `sendInvoiceViaChat()` - Must be `async`, must `await`
6. ✅ `sendInvoiceViaEmail()` - Must be `async`, must `await`
7. ✅ `emailInvoice()` - Must be `async`, must `await`
8. ✅ `chatInvoice()` - Must be `async`, must `await`

**Pattern:**
```javascript
async function functionName() {
  const connectedUsers = await cleartrackData.getConnectedUsers(practitioner.id);
  // ... use connectedUsers
}
```

**Why:** `getConnectedUsers()` queries Firestore asynchronously. Without `await`, you get a Promise object instead of the actual array.

---

## 12. DATA INTEGRATION POINTS

### 12.1 Firestore Collections Used

1. **`users`**
   - Practitioner document: `where('role', '==', 'practitioner')`
   - Client documents: `where('connectedPractitioner', '==', practitionerId)`

2. **`taxReturns`**
   - Filtered by practitioner ID

3. **`invoices`**
   - Filtered by practitioner ID

4. **`connections`**
   - Active connections for practitioner

5. **`messages`**
   - Messages between practitioner and clients

### 12.2 Data Manager Usage

**`cleartrackData`** (from `shared-data.js`)
- `getConnectedUsers(practitionerId)` - Gets clients
- `getUserDocuments(userId)` - Gets client documents
- `getUserExpenses(userId)` - Gets client expenses
- `getInvoicesForPractitioner(practitionerId)` - Gets invoices

**`firestoreData`** (from `firestore-data.js`)
- Used internally by `cleartrackData`
- Direct Firestore queries

---

## 13. REAL-TIME UPDATES

### 13.1 Polling System
- **Interval:** 2 seconds
- **Function:** `loadConversations()`
- **Purpose:** Keep client list and messages updated
- **Location:** Bottom of HTML file

### 13.2 Firestore Listeners
- Used for real-time message updates
- Managed by `messaging-service.js`

---

## 14. ERROR HANDLING PATTERNS

### 14.1 Null Checks
```javascript
if (!practitioner) return;
if (!practitioner.id) return;
```

### 14.2 Try-Catch Blocks
```javascript
try {
  // Firestore operation
} catch (error) {
  console.error('Error message:', error);
  // Show user-friendly error
}
```

### 14.3 Fallback Patterns
```javascript
// Try Firestore first, fallback to localStorage
const data = await firestoreData.getData() || cleartrackData.getData();
```

---

## 15. MODAL PATTERNS

### 15.1 Modal Structure
```html
<div id="modalId" class="modal-overlay hidden">
  <div class="modal-content">
    <!-- Modal content -->
  </div>
</div>
```

### 15.2 Modal Functions
- **Show:** `modal.classList.remove('hidden')`
- **Hide:** `modal.classList.add('hidden')`
- **Toggle:** `modal.classList.toggle('hidden')`

### 15.3 Common Modals
- `allClientsModal` - All clients list
- `activeClientsModal` - Active clients list
- `pendingReturnsModal` - Pending tax returns
- `completedReturnsModal` - Completed tax returns
- `invoicePreviewModal` - Invoice preview
- `invoiceGenerationModal` - Generate invoice

---

## 16. FORM HANDLING

### 16.1 Invoice Form
**Function:** `setupInvoiceForm()` (line ~4702)
- Sets up VAT calculation
- Handles form submission
- Validates inputs

**Function:** `calculateVAT()` (line ~4737)
- Calculates VAT amount
- Updates total

### 16.2 Bank Details
**Function:** `loadBankDetails()` (line ~4783)
- Loads practitioner bank details
- Populates form

**Function:** `saveBankDetails()` (line ~4801)
- Saves bank details to Firestore
- Updates practitioner document

---

## 17. SEARCH & FILTER PATTERNS

### 17.1 Client Search
**Function:** `setupClientSearch()` (line ~6491)
- Filters clients by name/email
- Real-time search as user types

### 17.2 Client Filters
- All Clients
- With Documents
- With Expenses
- Recently Added

---

## 18. DASHBOARD STATISTICS

### 18.1 Update Function
**Function:** `updateDashboard()` (line ~6454)
- Updates all stat cards
- Calculates totals
- Updates recent activity

### 18.2 Stat Cards
- **Total Clients:** `#totalClients`
- **Active Clients:** `#activeClients`
- **Pending Returns:** `#pendingReturns`
- **Completed Returns:** `#completedReturns`

---

## 19. MOBILE RESPONSIVENESS

### 19.1 Mobile Menu
- Hamburger menu for mobile
- Toggle function: `toggleMobileMenu()`
- Closes on nav click

### 19.2 Responsive CSS
- Uses `responsive-fixes.css`
- Media queries for mobile breakpoints
- Touch-friendly buttons

---

## 20. INTEGRATION WITH ADMIN DASHBOARD

### 20.1 Client Reassignment Impact
- When admin reassigns clients, practitioner dashboard automatically updates
- `loadClients()` queries Firestore, so changes appear within 2 seconds (polling interval)
- No manual refresh needed

### 20.2 Status Changes
- Practitioner status changes (suspend/reactivate) affect dashboard access
- Handled by `dashboard-auth.js`

---

## 21. BEST PRACTICES

### 21.1 Function Naming
- Use descriptive names: `loadClients()`, `updateDashboard()`
- Async functions: Prefix with `async`
- Event handlers: Use descriptive names

### 21.2 Code Organization
- Group related functions together
- Use comments to separate sections
- Keep functions focused (single responsibility)

### 21.3 Error Handling
- Always check for null/undefined
- Use try-catch for async operations
- Show user-friendly error messages

### 21.4 Performance
- Use async/await properly
- Avoid unnecessary re-renders
- Cache data when possible

---

## 22. COMMON PATTERNS

### 22.1 Loading Pattern
```javascript
async function loadData() {
  try {
    const data = await getData();
    // Process data
    updateDisplay(data);
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to load data');
  }
}
```

### 22.2 Display Update Pattern
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

### 22.3 Modal Pattern
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

## 23. TESTING CHECKLIST

When modifying the practitioner dashboard, verify:

- [ ] All async functions properly await promises
- [ ] Client list loads correctly
- [ ] Messages load and send correctly
- [ ] Invoices generate and send correctly
- [ ] Navigation between sections works
- [ ] Mobile menu works
- [ ] Statistics update correctly
- [ ] Modals open/close correctly
- [ ] Forms submit correctly
- [ ] Error handling works
- [ ] Real-time updates work (polling)

---

## 24. VERSION HISTORY

**Last Updated:** Based on current codebase
**Key Changes:**
- Fixed async/await issues in client loading functions
- Standardized header structure
- Improved error handling
- Added comprehensive function documentation

---

## 25. NOTES

- This dashboard is a Single Page Application (SPA)
- All sections are in one HTML file
- Uses Firebase/Firestore for data storage
- Real-time updates via polling (2-second interval)
- Offline support via localStorage caching
- Mobile-responsive design

---

**Use this document as a reference when:**
- Adding new features
- Modifying existing functions
- Debugging issues
- Understanding data flow
- Maintaining consistency

