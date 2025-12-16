# ClearTrack Application - Developer Brief

## Executive Summary

**ClearTrack** is a Progressive Web App (PWA) for SARS-compliant travel logbook and tax management in South Africa. It connects tax practitioners with their clients, enabling document management, expense tracking, tax return processing, and secure communication.

**Built by:** JellyBean Accounting (South Africa)  
**Domain Structure:**
- **Marketing Site:** `cleartrack.co.za` - Normal browser experience (landing page, marketing content)
- **Application:** `app.cleartrack.co.za` - PWA experience (login, dashboards, all app functionality)
**Tech Stack:** Firebase (Auth, Firestore, Hosting, Functions), Vanilla JavaScript, HTML5/CSS3

---

## Quick Reference

### 🎨 Design System
- **Primary Color:** Teal (`#0b7285`) - defined as CSS variable `--ct-primary`
- **Color Palette:** Comprehensive system using CSS variables (see Section 8.2)
- **Buttons:** Standardized button system with variants (primary, success, secondary, outline, danger)
- **Modals:** Consistent modal structure with overlay, header, body, and actions
- **Typography:** System UI font stack with responsive sizing
- **Layout:** Global structure pattern used across all pages
- **Mobile-First:** Fully responsive design optimized for mobile, tablet, and desktop (see Section 8.6)

---

## 1. Application Overview

### 1.1 What ClearTrack Does

ClearTrack is a Progressive Web App (PWA) that helps South African taxpayers maintain SARS-compliant travel logbooks and manage their tax documentation. The app is fully mobile-responsive and can be installed on mobile devices. It connects clients (taxpayers) with tax practitioners, enabling:

**Domain Structure:**
- **Marketing Site** (`cleartrack.co.za`): Standard website experience for marketing, information, and public pages
- **Application** (`app.cleartrack.co.za`): Full PWA experience with login, dashboards, and all application functionality

- **Travel Logbook Management:** Clients record business trips with dates, odometer readings, routes, and business purposes
- **Document Storage:** Upload and organize tax-related documents (logbooks, IRP5s, invoices, receipts)
- **Expense Tracking:** Record and categorize business expenses (fuel, services, repairs)
- **Vehicle Management:** Track multiple vehicles and link trips/expenses to specific vehicles
- **Practitioner Collaboration:** Secure sharing of data between clients and their tax practitioners
- **Tax Return Preparation:** Practitioners can generate tax returns and invoices for clients
- **Communication:** Built-in messaging system for client-practitioner communication

### 1.2 User Roles & Workflows

**Clients (Taxpayers):**
- Register and create account
- Connect to a tax practitioner (via code, invite link, or request)
- Add vehicles and record trips
- Upload documents and track expenses
- View tax returns prepared by practitioner
- Communicate with practitioner via messaging

**Practitioners (Tax Professionals):**
- Apply to become a ClearTrack practitioner (admin approval required)
- Register after approval
- Manage multiple clients
- Generate client invites (codes or links)
- View client data (documents, expenses, vehicles, trips)
- Generate tax returns for clients
- Create invoices for services
- Communicate with clients via messaging

**Admins:**
- Review and approve practitioner applications
- Manage users and system settings

### 1.3 Domain Structure & PWA

**Domain Separation:**

1. **Marketing Site** (`cleartrack.co.za`):
   - Standard website experience
   - No PWA features
   - Landing page, marketing content, public information
   - Normal browser behavior

2. **Application** (`app.cleartrack.co.za`):
   - Full Progressive Web App (PWA) experience
   - Installable on mobile devices and desktop
   - Offline support via service worker
   - App-like experience (full-screen, standalone)
   - Login page and all dashboards
   - Service worker, manifest, splash screens enabled

**PWA Features (app.cleartrack.co.za only):**
- Installable on iOS and Android
- Offline functionality
- App icons and splash screens
- Full-screen mode when installed
- Push notifications (if implemented)
- Background sync

### 1.4 Mobile-First Design

The application is built with a mobile-first, responsive design approach. All pages are optimized for:
- **Mobile devices** (phones) - Primary focus
- **Tablets** - Enhanced layouts
- **Desktop** - Full-featured experience

The design ensures touch-friendly interactions, readable typography, and efficient use of screen space across all device sizes. See Section 8.5 for detailed mobile optimization information.

### 1.5 Global Structure Pattern

The application uses a consistent global structure pattern across all pages. Every page follows this standardized layout:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Meta tags -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Title - ClearTrack</title>
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="assets/images/icon%20logo.png">
    
    <!-- Global Stylesheets (REQUIRED) -->
    <link rel="stylesheet" href="/global-styles.css">
    <link rel="stylesheet" href="/css/ct-theme.css">
    <link rel="stylesheet" href="/header-responsive-fixes.css">
    
    <!-- Page-specific stylesheets (if needed) -->
    
    <!-- PWA Features (only on app.cleartrack.co.za) -->
    <script>
        // PWA initialization script
    </script>
</head>
<body>
    <!-- HEADER (Consistent across all pages) -->
    <header>
        <div class="header-top">
            <div class="brand">
                <img src="assets/images/full%20logo%20CT.png" alt="ClearTrack Logo">
            </div>
            
            <!-- Hamburger menu (mobile/tablet) -->
            <button class="menu-toggle-style6" aria-label="Toggle menu" id="menuToggle">
                <!-- SVG hamburger icon -->
            </button>
            
            <!-- Navigation -->
            <nav class="nav-style6" id="mainNav">
                <!-- Navigation links -->
            </nav>
        </div>
    </header>
    
    <!-- MAIN CONTENT -->
    <main>
        <!-- Page-specific content -->
    </main>
    
    <!-- FOOTER (Consistent across all pages) -->
    <footer>
        <!-- Footer content -->
    </footer>
    
    <!-- Scripts -->
    <!-- Firebase SDKs -->
    <script src="https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.11/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore-compat.js"></script>
    
    <!-- Firebase Config & Init -->
    <script src="firebase-config.js"></script>
    <script src="firebase-init.js"></script>
    
    <!-- Page-specific scripts -->
</body>
</html>
```

**Structure Components:**
- **Header:** Consistent header with logo, navigation, and responsive hamburger menu
- **Main Content:** Wrapped in `<main>` tag with standardized styling
- **Footer:** Consistent footer across all pages
- **Stylesheets:** All pages include `global-styles.css`, `css/ct-theme.css`, and `header-responsive-fixes.css`
- **Responsive Design:** Mobile-first approach with consistent breakpoints (see Section 8.6)
- **Navigation:** Unified navigation pattern with mobile hamburger menu
- **Mobile Optimization:** Touch-friendly buttons (minimum 44px), responsive tables, mobile-optimized forms

This structure ensures a consistent user experience across all devices, easier maintenance, and better accessibility. The app is fully mobile-friendly and works seamlessly on phones, tablets, and desktops.

### 1.2 Project Structure

```
Cleartrack App 2/
├── public/                    # All frontend files (served by Firebase Hosting)
│   ├── index.html            # Landing page
│   ├── login.html            # Login/Registration
│   ├── user-dashboard.html   # Client dashboard (~3,500+ lines)
│   ├── practitioner-dashboard.html  # Practitioner dashboard (~7,000+ lines)
│   ├── admin-dashboard.html  # Admin dashboard
│   ├── client-onboarding.html # Client onboarding flow
│   ├── practitioner-application.html # Practitioner application form
│   ├── practitioner-register.html   # Practitioner registration
│   ├── reset-password.html   # Password reset
│   ├── contact.html          # Contact form
│   ├── privacy.html          # Privacy policy
│   ├── terms.html            # Terms of service
│   ├── firebase-config.js    # Firebase configuration
│   ├── firebase-init.js      # Firebase initialization
│   ├── firebase-api.js       # Firebase API wrapper
│   ├── dashboard-auth.js     # Dashboard authentication guard
│   ├── login.js              # Login/registration logic
│   ├── shared-data.js        # Data management layer
│   ├── app.js                # Main app logic
│   ├── css/                  # Stylesheets
│   ├── assets/               # Images, icons
│   └── icons/                # PWA icons
├── functions/                # Firebase Cloud Functions
│   └── index.js              # All backend functions
├── firebase.json             # Firebase configuration
└── firestore.rules           # Firestore security rules
```

---

## 2. Application Pages & Features

### 2.1 Public Pages

### 2.1 Public Pages

#### **index.html** - Landing Page
- **Purpose:** Marketing/landing page for ClearTrack
- **Features:**
  - Hero section with value proposition
  - Feature cards (mileage logbook, document storage, etc.)
  - Target audience sections
  - Navigation to login, practitioner application, contact
  - Fully responsive design (mobile, tablet, desktop)
- **Domain:** `cleartrack.co.za` - Standard website (not PWA)
- **Redirect:** On `app.cleartrack.co.za`, redirects `/` to `/login.html`
- **Mobile:** Optimized for mobile viewing with responsive grid layouts

#### **login.html** - Authentication
- **Purpose:** User login and registration
- **Domain:** `app.cleartrack.co.za` - PWA experience
- **Features:**
  - Tabbed interface (Sign In / Create Account)
  - Email/password authentication
  - Password visibility toggle
  - Forgot password link
  - Role selection during registration
  - Invite code processing (for client-practitioner linking)
  - Full PWA support (installable, offline capable)
- **Scripts:** `login.js`, `firebase-init.js`, `firebase-config.js`
- **Post-Login:** Routes to appropriate dashboard based on role

#### **reset-password.html** - Password Reset
- **Purpose:** Handle password reset flow
- **Features:**
  - Email input for password reset
  - Firebase password reset email
  - Success/error messaging
- **Scripts:** `reset-password.js`

#### **contact.html** - Contact Form
- **Purpose:** Contact JellyBean Accounting
- **Features:**
  - Contact form (name, email, message)
  - Form submission handling
- **Note:** May use Firebase Functions or external service

#### **privacy.html** & **terms.html** - Legal Pages
- **Purpose:** Privacy policy and terms of service
- **Content:** Static legal text

---

### 2.2 Client/User Pages

#### **user-dashboard.html** - Client Dashboard
- **Purpose:** Main interface for clients to manage their tax data
- **Domain:** `app.cleartrack.co.za` - PWA experience
- **PWA Features:** Installable, offline support, app-like experience
- **Mobile-Optimized:** Fully responsive with mobile-friendly navigation, touch-optimized buttons, and responsive tables
- **Key Sections:**
  1. **Dashboard Overview**
     - Stats: Documents uploaded, vehicles registered, expenses recorded, total expenses
     - Quick actions: Upload document, add vehicle, record expense, update profile
  
  2. **Documents Section**
     - Upload documents (logbooks, IRP5s, invoices, etc.)
     - View/download uploaded documents
     - Document categories and filtering
  
  3. **Vehicles Section**
     - Add/edit vehicles
     - Vehicle details (make, model, registration, etc.)
     - Link trips to vehicles
  
  4. **Expenses Section**
     - Record expenses (fuel, services, repairs, etc.)
     - Expense categories
     - Date and amount tracking
  
  5. **Profile Section**
     - Personal information (name, email, phone, tax number, etc.)
     - Profile image upload
     - Update account details
  
  6. **Practitioner Connection**
     - Connect to practitioner via code
     - View connected practitioner details
     - Request practitioner connection

- **Data Management:**
  - Uses `shared-data.js` for data operations
  - Syncs with Firestore (primary) and localStorage (cache)
  - Real-time updates when connected to practitioner

- **Authentication:** Protected by `dashboard-auth.js`

#### **client-onboarding.html** - Client Onboarding
- **Purpose:** Guided setup for new clients
- **Features:**
  - Step-by-step wizard
  - Practitioner connection (via code or request)
  - Initial profile setup
  - Vehicle registration
  - Document upload guidance
- **Flow:** Redirects to `user-dashboard.html` after completion

---

### 2.3 Practitioner Pages

#### **practitioner-dashboard.html** - Practitioner Dashboard
- **Purpose:** Main interface for tax practitioners
- **Domain:** `app.cleartrack.co.za` - PWA experience
- **PWA Features:** Installable, offline support, app-like experience
- **Mobile-Optimized:** Fully responsive dashboard with mobile-friendly client management, touch-optimized interactions, and responsive data tables
- **Key Sections:**
  1. **Dashboard Overview**
     - Stats: Total clients, active clients, pending returns, completed returns
     - Quick actions
  
  2. **Clients Management**
     - View all clients
     - Add new clients (via invite code/link)
     - Client details view
     - Disconnect clients
     - Client search and filtering
  
  3. **Client Invites**
     - Generate invite codes/links
     - SMS/email invite sending (optional)
     - Track invite status (pending, accepted, expired)
  
  4. **Tax Returns**
     - Generate tax returns for clients
     - View client tax return data
     - Status tracking (pending, in progress, completed)
     - Export functionality
  
  5. **Invoices**
     - Generate invoices for clients
     - VAT calculations
     - Invoice management and tracking
  
  6. **Documents**
     - View all client documents
     - Download client documents
     - Document organization by client
  
  7. **Messaging**
     - WhatsApp-style messaging interface
     - Real-time communication with clients
     - Message history
  
  8. **Profile**
     - Practitioner profile management
     - Practice details
     - Practitioner code (for client connections)

- **Data Management:**
  - Loads practitioner profile from Firestore
  - Manages client connections
  - Real-time client data sync

- **Authentication:** Protected by `dashboard-auth.js`

#### **practitioner-application.html** - Practitioner Application
- **Purpose:** Form for tax practitioners to apply for ClearTrack access
- **Fields:**
  - Personal info (name, email, phone)
  - Practice details (name, number, SARS number)
  - Experience (years, qualifications)
  - Specializations (array)
  - Bio and message
- **Submission:** Creates document in `practitionerApplications` collection
- **Backend:** `submitPractitionerApplication` Cloud Function
- **Post-Submission:** Admin reviews and approves

#### **practitioner-register.html** - Practitioner Registration
- **Purpose:** Complete registration after application approval
- **Flow:**
  1. Admin approves application
  2. Practitioner receives email with registration link and code
  3. Practitioner enters code and sets password
  4. Account created with `role: 'practitioner'`
- **Backend:** `verifyPractitionerInvite` and `completePractitionerRegistration` Cloud Functions

---

### 2.4 Admin Pages

#### **admin-dashboard.html** - Admin Dashboard
- **Purpose:** System administration
- **Features:**
  - View practitioner applications
  - Approve/reject applications
  - Manage users
  - System settings
- **Authentication:** Requires `role: 'admin'`
- **Backend:** `approvePractitionerApplication` Cloud Function

---

## 3. Core Functionality & Features

### 3.1 Client-Practitioner Connection System

**Three Connection Methods:**

1. **Invite Code/Link (Practitioner-Initiated)**
   - Practitioner generates invite via dashboard
   - Invite includes: code, link, optional mobile number
   - Client uses code/link during registration or in dashboard
   - Backend: `createClientInvite`, `verifyClientInvite` Cloud Functions

2. **Practitioner Code (Client-Initiated)**
   - Client enters practitioner's unique code (e.g., `PRAC123456`)
   - Code links client to practitioner
   - Handled in `client-onboarding.html` or user dashboard

3. **Client Request (Auto-Assignment)**
   - Client requests practitioner connection
   - System auto-assigns to available practitioner (round-robin)
   - Practitioner can accept/decline
   - Backend: `createClientRequest`, `respondToClientRequest` Cloud Functions

### 3.2 Document Management

- **Storage:** Firestore (metadata) + Firebase Storage (files)
- **Features:**
  - Upload documents (PDF, images, etc.)
  - Categorize documents
  - View/download documents
  - Practitioner can view all client documents
- **Data Structure:** `documents` collection with `userId`, `practitionerId`, metadata

### 3.3 Expense Tracking

- **Features:**
  - Record expenses (fuel, services, repairs, etc.)
  - Link expenses to vehicles
  - Date, amount, category tracking
  - Total expense calculations
- **Data Structure:** `expenses` collection

### 3.4 Vehicle Management

- **Features:**
  - Add/edit vehicles
  - Vehicle details (make, model, registration, year, etc.)
  - Link trips/expenses to vehicles
- **Data Structure:** `vehicles` collection

### 3.5 Tax Return Management

- **Features:**
  - Practitioner generates tax returns for clients
  - Status tracking (pending, in progress, completed)
  - Export functionality
  - Client can view their tax returns
- **Data Structure:** `taxReturns` collection

### 3.6 Invoice Management

- **Features:**
  - Generate invoices for clients
  - VAT calculations (South African tax)
  - Invoice tracking and management
- **Data Structure:** `invoices` collection

### 3.7 Messaging System

- **Features:**
  - WhatsApp-style messaging interface
  - Real-time communication between practitioner and clients
  - Message history
  - Styled with `whatsapp-messaging.css`
- **Data Structure:** `messages` collection

---

## 4. Technical Architecture

### 4.1 Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Backend:** Firebase
  - **Authentication:** Firebase Auth (email/password)
  - **Database:** Firestore (primary) + localStorage (cache/offline)
  - **Hosting:** Firebase Hosting
  - **Functions:** Cloud Functions (Node.js 18)
- **External Services:**
  - SendGrid/Mailgun (email)
  - Twilio (SMS - optional)
- **PWA Features:** Service Worker, Manifest, iOS Splash Screens (only on `app.cleartrack.co.za`)
- **Mobile Support:** Fully responsive design, mobile-first approach, touch-optimized interactions, installable PWA
- **Domain Separation:**
  - `cleartrack.co.za` - Marketing site (standard website, no PWA)
  - `app.cleartrack.co.za` - Application (full PWA with install, offline, app-like experience)

### 4.2 Project Structure

```
Cleartrack App 2/
├── public/                    # All frontend files (served by Firebase Hosting)
│   ├── index.html            # Landing page
│   ├── login.html            # Login/Registration
│   ├── user-dashboard.html   # Client dashboard
│   ├── practitioner-dashboard.html  # Practitioner dashboard
│   ├── admin-dashboard.html  # Admin dashboard
│   ├── client-onboarding.html # Client onboarding flow
│   ├── practitioner-application.html # Practitioner application form
│   ├── practitioner-register.html   # Practitioner registration
│   ├── reset-password.html   # Password reset
│   ├── contact.html          # Contact form
│   ├── privacy.html          # Privacy policy
│   ├── terms.html            # Terms of service
│   ├── firebase-config.js    # Firebase configuration
│   ├── firebase-init.js      # Firebase initialization
│   ├── firebase-api.js       # Firebase API wrapper
│   ├── dashboard-auth.js     # Dashboard authentication guard
│   ├── login.js              # Login/registration logic
│   ├── shared-data.js        # Data management layer
│   ├── app.js                # Main app logic
│   ├── css/                  # Stylesheets
│   ├── assets/               # Images, icons
│   └── icons/                # PWA icons
├── functions/                # Firebase Cloud Functions
│   └── index.js              # All backend functions
├── firebase.json             # Firebase configuration
└── firestore.rules           # Firestore security rules
```

---

## 5. Backend (Firebase Cloud Functions)

### 5.1 Client-Practitioner Connection Functions

- **`createClientInvite`**: Practitioner creates invite for client
- **`verifyClientInvite`**: Client verifies invite code to link
- **`createClientRequest`**: Client requests practitioner connection
- **`respondToClientRequest`**: Practitioner accepts/declines request

### 5.2 Practitioner Application Functions

- **`submitPractitionerApplication`**: Submit application to become practitioner
- **`approvePractitionerApplication`**: Admin approves application and generates invite
- **`verifyPractitionerInvite`**: Verify practitioner registration token/code
- **`completePractitionerRegistration`**: Complete registration with password

### 5.3 Email/SMS Functions

- **Email:** SendGrid (primary) or Mailgun (fallback)
- **SMS:** Twilio (optional, for client invites)
- **Configuration:** Environment variables or Firebase Functions config

### 5.4 Firestore Triggers

- **`onPractitionerApproved`**: Triggered when application status changes to "approved"
  - Creates Firebase Auth user
  - Generates password reset link
  - Sends approval email

---

## 6. Data Models & Storage

### 6.1 Data Storage Strategy

The application uses a dual storage approach:
- **Primary Storage:** Firestore (cloud database) - source of truth
- **Secondary Storage:** localStorage (browser cache) - for offline support and faster local access
- **Synchronization:** `shared-data.js` handles syncing between Firestore and localStorage

### 6.2 Data Collections (Firestore)

- **`users`**: User profiles (clients, practitioners, admins)
  - Fields: `role`, `email`, `firstName`, `lastName`, `practitionerId`, `practitionerCode`, etc.

- **`clientInvites`**: Practitioner-created client invites
  - Fields: `inviteId`, `code`, `mobile`, `practitionerId`, `status`, `expiresAt`

- **`clientRequests`**: Client requests for practitioner connection
  - Fields: `requestId`, `clientUid`, `needs`, `assignedPractitionerId`, `status`

- **`practitionerApplications`**: Practitioner applications
  - Fields: `applicationId`, `firstName`, `lastName`, `email`, `practiceName`, `status`

- **`practitionerInvites`**: Practitioner registration invites
  - Fields: `token`, `code`, `applicationId`, `email`, `status`, `expiresAt`

- **`connections`**: Client-practitioner connections
  - Fields: `userId`, `practitionerId`, `connectedAt`, `status`

- **`documents`**: User documents
  - Fields: `userId`, `practitionerId`, `name`, `type`, `url`, `uploadedAt`

- **`expenses`**: User expenses
  - Fields: `userId`, `vehicleId`, `amount`, `category`, `date`, `description`

- **`vehicles`**: User vehicles
  - Fields: `userId`, `make`, `model`, `registration`, `year`

- **`taxReturns`**: Tax returns
  - Fields: `userId`, `practitionerId`, `year`, `status`, `data`

- **`invoices`**: Invoices
  - Fields: `userId`, `practitionerId`, `amount`, `vat`, `status`, `createdAt`

- **`messages`**: Messages between users and practitioners
  - Fields: `userId`, `practitionerId`, `message`, `senderId`, `timestamp`

---

## 7. Frontend Architecture

### 7.1 Key JavaScript Files

**Core Files:**

- **`firebase-config.js`**: Firebase configuration object
- **`firebase-init.js`**: Initializes Firebase services (Auth, Firestore)
- **`firebase-api.js`**: API wrapper for Firebase operations
- **`shared-data.js`**: Data management layer (CleartrackDataManager class)
  - Handles Firestore + localStorage sync
  - CRUD operations for all data types
  - Offline support

**Authentication Files:**

- **`login.js`**: Login and registration logic
- **`dashboard-auth.js`**: Authentication guard for dashboards
- **`reset-password.js`**: Password reset handling

**Dashboard Files:**

- **`app.js`**: Main app logic (shared utilities)
- **`user-dashboard.html`**: Contains inline JavaScript for client dashboard
- **`practitioner-dashboard.html`**: Contains inline JavaScript for practitioner dashboard

### 7.2 Data Management

The `shared-data.js` file contains the `CleartrackDataManager` class which handles:
- All CRUD operations for users, practitioners, connections, documents, expenses, vehicles, tax returns, invoices
- Dual storage synchronization (Firestore + localStorage)
- Offline support and caching
- Data validation and error handling

---

## 8. Design System & UI Components

### 8.1 CSS Files

- **`global-styles.css`**: Global styles and base layout patterns
- **`css/ct-theme.css`**: ClearTrack theme variables and utility classes
- **`user-dashboard-styles.css`**: Client dashboard styles
- **`practitioner-dashboard-styles.css`**: Practitioner dashboard styles
- **`whatsapp-messaging.css`**: Messaging interface styles
- **`header-responsive-fixes.css`**: Responsive header fixes
- **`unified-header.css`**: Unified header component

### 8.1.1 CSS Guidelines

**File Organization:**
- Global styles go in `global-styles.css`
- Theme variables go in `css/ct-theme.css`
- Page-specific styles can be inline or in separate files
- Component-specific styles (buttons, modals) are in `global-styles.css`

**CSS Best Practices:**
- **Use CSS variables** - Always use `var(--ct-*)` for colors, never hardcode hex values
- **Mobile-first** - Write base styles for mobile, then use `@media (min-width: ...)` for larger screens
- **Semantic class names** - Use descriptive names (`.btn-primary`, not `.blue-button`)
- **Consistent spacing** - Use the spacing scale (0.5rem, 1rem, 1.5rem, 2rem, etc.)
- **Responsive units** - Use `rem` for typography, `%` or `vw/vh` for layout, `px` only for borders
- **Flexbox/Grid** - Use modern layout methods (Flexbox for components, Grid for layouts)
- **Avoid inline styles** - Use classes instead (except for dynamic values)
- **Specificity** - Keep specificity low, avoid `!important` unless necessary
- **Naming convention** - Use kebab-case for class names (`.modal-header`, not `.modalHeader`)

**Responsive Breakpoints:**
```css
/* Mobile-first: base styles for mobile */
.element {
    /* Mobile styles */
}

/* Tablet and up */
@media (min-width: 481px) {
    .element {
        /* Tablet styles */
    }
}

/* Desktop and up */
@media (min-width: 769px) {
    .element {
        /* Desktop styles */
    }
}
```

**Spacing Scale:**
- `0.25rem` (4px) - Tight spacing
- `0.5rem` (8px) - Small spacing
- `0.75rem` (12px) - Medium-small spacing
- `1rem` (16px) - Base spacing
- `1.5rem` (24px) - Medium spacing
- `2rem` (32px) - Large spacing
- `3rem` (48px) - Extra large spacing

**Typography Scale:**
- Use `clamp()` for responsive font sizes
- Example: `font-size: clamp(0.875rem, 2vw, 1rem);`
- Base font size: `1rem` (16px)
- Line height: `1.5` or `1.6` for body text, `1.2` for headings

### 8.2 Color Palette

The application uses a comprehensive color system defined in `css/ct-theme.css` using CSS variables. All colors are accessed via these variables to ensure consistency and easy theming.

#### Primary Colors (ClearTrack Brand)

```css
--ct-primary: #0b7285;           /* Primary teal - main brand color */
--ct-primary-dark: #095a69;      /* Darker teal - hover states, emphasis */
--ct-bg-soft: #e5f3f7;           /* Soft teal background - page backgrounds */
--ct-header-text: #ffffff;       /* White text for headers */
```

**Usage:**
```css
/* ✅ CORRECT - Use CSS variables */
background-color: var(--ct-primary);
color: var(--ct-header-text);

/* ❌ WRONG - Don't hardcode colors */
background-color: #0b7285;
```

#### Semantic Colors

```css
/* Success/Positive Actions */
--ct-success: #059669;           /* Green - success states */
--ct-success-dark: #047857;      /* Darker green - hover */

/* Warning/Caution */
--ct-warning: #d97706;           /* Orange - warnings */

/* Error/Danger */
--ct-danger: #dc2626;            /* Red - errors, destructive actions */

/* Neutral Grays */
--ct-gray-50: #f9fafb;           /* Lightest gray - backgrounds */
--ct-gray-100: #f3f4f6;          /* Light gray - subtle backgrounds */
--ct-gray-200: #e5e7eb;          /* Border gray */
--ct-gray-300: #d1d5db;          /* Input borders */
--ct-gray-400: #9ca3af;          /* Disabled text */
--ct-gray-500: #6b7280;          /* Secondary text */
--ct-gray-600: #4b5563;          /* Muted text */
--ct-gray-700: #374151;          /* Body text */
--ct-gray-800: #1f2937;          /* Headings */
--ct-gray-900: #111827;          /* Darkest text */
```

#### Text Colors

```css
--ct-text-primary: #111827;      /* Primary text (headings, important) */
--ct-text-secondary: #6b7280;    /* Secondary text (descriptions) */
--ct-text-muted: #9ca3af;        /* Muted text (hints, disabled) */
```

#### Background Colors

```css
--ct-bg-primary: #ffffff;        /* White - card backgrounds */
--ct-bg-secondary: #f9fafb;      /* Light gray - page backgrounds */
--ct-bg-soft: #e5f3f7;           /* Soft teal - accent backgrounds */
```

#### Border Colors

```css
--ct-border-light: #e5e7eb;      /* Light borders */
--ct-border-medium: #d1d5db;     /* Medium borders (inputs) */
--ct-border-dark: #9ca3af;       /* Dark borders */
```

#### Status Colors

```css
/* Status indicators */
--ct-status-success: #059669;    /* Success status */
--ct-status-warning: #d97706;    /* Warning status */
--ct-status-error: #dc2626;      /* Error status */
--ct-status-info: #0b7285;       /* Info status (uses primary) */
```

#### Button Colors

```css
/* Primary Button */
.btn-primary {
    background-color: var(--ct-primary);
    color: var(--ct-header-text);
}
.btn-primary:hover {
    background-color: var(--ct-primary-dark);
}

/* Success Button */
.btn-success {
    background-color: var(--ct-success);
    color: var(--ct-header-text);
}
.btn-success:hover {
    background-color: var(--ct-success-dark);
}

/* Secondary Button */
.btn-secondary {
    background-color: var(--ct-gray-500);
    color: var(--ct-header-text);
}
.btn-secondary:hover {
    background-color: var(--ct-gray-600);
}

/* Outline Button */
.btn-outline {
    background-color: transparent;
    border: 1px solid var(--ct-primary);
    color: var(--ct-primary);
}
.btn-outline:hover {
    background-color: var(--ct-bg-soft);
}
```

#### Color Usage Guidelines

**When to Use Each Color:**

1. **Primary Color (`--ct-primary`)** - Use for:
   - Main call-to-action buttons
   - Primary navigation elements
   - Links and interactive elements
   - Brand accents and highlights
   - Important status indicators

2. **Success Color (`--ct-success`)** - Use for:
   - Success messages and confirmations
   - Positive action buttons (approve, accept, complete)
   - Success status indicators
   - Completed states

3. **Warning Color (`--ct-warning`)** - Use for:
   - Warning messages
   - Caution indicators
   - Pending states
   - Attention-required items

4. **Danger Color (`--ct-danger`)** - Use for:
   - Error messages
   - Destructive action buttons (delete, remove)
   - Error status indicators
   - Critical alerts

5. **Gray Scale** - Use for:
   - Secondary text (`--ct-text-secondary`)
   - Muted text (`--ct-text-muted`)
   - Borders (`--ct-border-*`)
   - Backgrounds (`--ct-bg-*`)
   - Disabled states

**Color Usage Rules:**

1. **Always use CSS variables** - Never hardcode hex colors
   ```css
   /* ✅ CORRECT */
   color: var(--ct-primary);
   
   /* ❌ WRONG */
   color: #0b7285;
   ```

2. **Use semantic colors** - Choose colors based on meaning, not appearance
   ```css
   /* ✅ CORRECT - semantic */
   background-color: var(--ct-success);
   
   /* ❌ WRONG - appearance-based */
   background-color: var(--ct-green);
   ```

3. **Maintain contrast** - Ensure text is readable (WCAG AA: 4.5:1 minimum)
   - Light text on dark backgrounds
   - Dark text on light backgrounds
   - Test contrast ratios

4. **Hover states** - Use darker variants for hover
   ```css
   .button {
       background-color: var(--ct-primary);
   }
   .button:hover {
       background-color: var(--ct-primary-dark);
   }
   ```

5. **Disabled states** - Use muted grays
   ```css
   .button:disabled {
       background-color: var(--ct-gray-300);
       color: var(--ct-gray-500);
   }
   ```

6. **Status colors** - Use consistently across the app
   - Success = Green (`--ct-success`)
   - Warning = Orange (`--ct-warning`)
   - Error = Red (`--ct-danger`)
   - Info = Primary teal (`--ct-primary`)

**Color Combinations:**

- **Primary on white:** `var(--ct-primary)` text on `var(--ct-bg-primary)` background
- **White on primary:** `var(--ct-header-text)` text on `var(--ct-primary)` background
- **Text hierarchy:** Primary text (`--ct-text-primary`) for headings, secondary (`--ct-text-secondary`) for body, muted (`--ct-text-muted`) for hints

**Accessibility:**
- All color combinations meet WCAG AA standards (4.5:1 contrast ratio)
- Don't rely on color alone to convey information (use icons, text, or patterns)
- Test with color blindness simulators
- Provide alternative indicators (icons, text labels)

### 8.3 Buttons

The application uses a standardized button system defined in `global-styles.css`. All buttons use the `.btn` base class with variant modifiers.

```html
<button class="btn">Button Text</button>
```

#### Button Variants

```html
<!-- Primary Button (Main actions) -->
<button class="btn btn-primary">Save</button>

<!-- Success Button (Positive actions) -->
<button class="btn btn-success">Approve</button>

<!-- Secondary Button (Neutral actions) -->
<button class="btn btn-secondary">Cancel</button>

<!-- Outline Button (Secondary actions) -->
<button class="btn btn-outline">View Details</button>

<!-- Danger Button (Destructive actions) -->
<button class="btn btn-danger">Delete</button>
```

#### Button Sizes

```html
<!-- Small Button -->
<button class="btn btn-primary btn-sm">Small</button>

<!-- Default Button (no size class) -->
<button class="btn btn-primary">Default</button>

<!-- Large Button -->
<button class="btn btn-primary btn-lg">Large</button>

<!-- Full Width Button (mobile-friendly) -->
<button class="btn btn-primary btn-full">Full Width</button>
```

#### Button with Icons

```html
<!-- Button with icon (icon appears before text) -->
<button class="btn btn-primary">
    <img src="assets/icons/check.svg" class="icon" alt="Check">
    Save
</button>

<!-- Icon-only button -->
<button class="icon-button" aria-label="Edit">
    <img src="assets/icons/edit.svg" class="icon" alt="Edit">
</button>
```

#### Button Groups

```html
<!-- Horizontal button group -->
<div class="button-group">
    <button class="btn btn-primary">Save</button>
    <button class="btn btn-outline">Cancel</button>
</div>

<!-- Modal actions (footer buttons) -->
<div class="modal-actions">
    <button class="btn btn-outline">Cancel</button>
    <button class="btn btn-primary">Confirm</button>
</div>
```

#### Button System Overview

The button system provides:
- **Semantic variants:** Primary (main actions), Success (positive actions), Danger (destructive actions), Secondary (neutral), Outline (secondary actions)
- **Size options:** Small (`.btn-sm`), Default, Large (`.btn-lg`), Full-width (`.btn-full`)
- **Icon support:** Buttons can include icons before text, or be icon-only with proper ARIA labels
- **Responsive behavior:** Buttons adapt to mobile with appropriate sizing and stacking
- **Accessibility:** All buttons use semantic HTML with proper ARIA labels and keyboard navigation
- **Color integration:** Button colors use CSS variables from the theme system

#### Button States

```html
<!-- Disabled button -->
<button class="btn btn-primary" disabled>Disabled</button>

<!-- Loading state (add spinner icon) -->
<button class="btn btn-primary">
    <span class="spinner"></span>
    Loading...
</button>
```

#### Button Examples

```html
<!-- Primary action -->
<button class="btn btn-primary" onclick="saveData()">
    <img src="assets/icons/check.svg" class="icon" alt="Save">
    Save Changes
</button>

<!-- Secondary action -->
<button class="btn btn-outline" onclick="cancel()">Cancel</button>

<!-- Destructive action -->
<button class="btn btn-danger" onclick="deleteItem()">
    <img src="assets/icons/trash.svg" class="icon" alt="Delete">
    Delete
</button>

<!-- Small button in table -->
<button class="btn btn-primary btn-sm" onclick="edit()">Edit</button>
```

### 8.4 Modals

The application uses a standardized modal system defined in `global-styles.css`. All modals follow a consistent structure with overlay, header, body, and actions sections.

```html
<!-- Modal Overlay (backdrop) -->
<div id="myModal" class="modal-overlay hidden">
    <!-- Modal Container -->
    <div class="modal">
        <!-- Modal Header -->
        <div class="modal-header">
            <h3 class="modal-title">Modal Title</h3>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        
        <!-- Modal Body -->
        <div class="modal-body">
            <!-- Modal content goes here -->
            <p>Modal content...</p>
        </div>
        
        <!-- Modal Actions (Footer) -->
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmAction()">Confirm</button>
        </div>
    </div>
</div>
```

#### Modal Sizes

```html
<!-- Standard Modal (default) -->
<div class="modal">
    <!-- Max width: 90vw, responsive -->
</div>

<!-- Large Modal (for complex content) -->
<div class="modal modal-large">
    <!-- Max width: 95vw on mobile, 800px on desktop -->
</div>
```

#### Modal JavaScript Functions

```javascript
// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
}

// Hide modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        // Restore body scroll
        document.body.style.overflow = '';
    }
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-overlay:not(.hidden)');
        if (openModal) {
            openModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }
});
```

#### Modal Examples

**Simple Confirmation Modal:**
```html
<div id="confirmModal" class="modal-overlay hidden">
    <div class="modal">
        <div class="modal-header">
            <h3 class="modal-title">Confirm Action</h3>
            <button class="modal-close" onclick="closeModal('confirmModal')">&times;</button>
        </div>
        <div class="modal-body">
            <p>Are you sure you want to proceed?</p>
        </div>
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal('confirmModal')">Cancel</button>
            <button class="btn btn-primary" onclick="confirmAction()">Confirm</button>
        </div>
    </div>
</div>
```

**Form Modal:**
```html
<div id="addItemModal" class="modal-overlay hidden">
    <div class="modal">
        <div class="modal-header">
            <h3 class="modal-title">Add New Item</h3>
            <button class="modal-close" onclick="closeModal('addItemModal')">&times;</button>
        </div>
        <div class="modal-body">
            <form id="addItemForm">
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" rows="4"></textarea>
                </div>
            </form>
        </div>
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal('addItemModal')">Cancel</button>
            <button class="btn btn-primary" onclick="submitForm()">Save</button>
        </div>
    </div>
</div>
```

**Large Content Modal:**
```html
<div id="detailsModal" class="modal-overlay hidden">
    <div class="modal modal-large">
        <div class="modal-header">
            <h3 class="modal-title">Item Details</h3>
            <button class="modal-close" onclick="closeModal('detailsModal')">&times;</button>
        </div>
        <div class="modal-body">
            <!-- Large content here -->
        </div>
        <div class="modal-actions">
            <button class="btn btn-primary" onclick="closeModal('detailsModal')">Close</button>
        </div>
    </div>
</div>
```

#### Modal System Overview

The modal system provides:
- **Structure:** Overlay backdrop, modal container, header with title and close button, scrollable body, and action footer
- **Sizing:** Standard modals (max 90vw/600px) and large modals (`.modal-large`) for complex content
- **Visibility:** Controlled via `.hidden` class toggle
- **Responsive:** Adapts to mobile with adjusted padding and full-width on small screens
- **Accessibility:** Keyboard navigation (Escape to close), focus trapping, proper ARIA labels
- **Behavior:** Prevents body scroll when open, supports overlay click to close, handles multiple modals

### 8.5 Mobile-First & Responsive Design

The application is built with a mobile-first approach, ensuring optimal experience across all device sizes.

#### Responsive Breakpoints

- **Mobile:** `< 481px` - Optimized for smartphones
- **Tablet:** `481px - 768px` - Optimized for tablets
- **Desktop:** `> 768px` - Full desktop experience

#### Mobile Optimizations

**Navigation:**
- Hamburger menu on mobile/tablet (horizontal navigation on desktop)
- Touch-friendly menu items (minimum 44px height)
- Smooth transitions and animations
- Menu closes on link click or outside click

**Buttons:**
- Minimum touch target: 44px × 44px
- Full-width buttons on mobile for easier tapping
- Button groups stack vertically on mobile
- Larger padding on mobile for better touch targets

**Forms:**
- Full-width inputs on mobile
- Larger input fields for easier typing
- Mobile-friendly date pickers
- Optimized keyboard input types

**Tables:**
- Horizontal scroll on mobile
- Responsive table containers
- Stacked layout options for small screens
- Touch-friendly table interactions

**Modals:**
- Full-width on mobile (90vw)
- Adjusted padding for mobile screens
- Touch-friendly close buttons
- Scrollable content areas

**Typography:**
- Responsive font sizes using `clamp()`
- Readable line heights on all devices
- Proper text wrapping to prevent overflow

**Images & Media:**
- Responsive images (max-width: 100%)
- Optimized image sizes for mobile
- Proper aspect ratios maintained

**Touch Interactions:**
- Large tap targets (minimum 44px)
- Adequate spacing between interactive elements
- Touch feedback (active states)
- Swipe gestures where appropriate

**Viewport Settings:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

#### PWA Mobile Features

- **Installable:** Can be installed on mobile devices as a native-like app
- **Offline Support:** Service worker enables offline functionality
- **App Icons:** Multiple icon sizes for different devices
- **Splash Screens:** Device-specific splash screens for iOS
- **Full-Screen Mode:** Runs in full-screen when installed
- **Theme Color:** Custom theme color for mobile browsers

#### Mobile-Specific Considerations

- **Performance:** Optimized for slower mobile connections
- **Data Usage:** Efficient data loading and caching
- **Battery:** Optimized animations and interactions
- **Orientation:** Works in both portrait and landscape
- **Keyboard:** Proper input types trigger correct mobile keyboards
- **Scrolling:** Smooth scrolling with proper overflow handling

### 8.6 Premium Dashboard Styling Guide

The dashboards should have a premium, professional appearance that reflects the quality and trustworthiness of the tax management service. Here's how to achieve a premium look:

#### Visual Hierarchy & Layout

**Card-Based Design:**
- Use elevated cards with subtle shadows for content sections
- Card shadows: `0 2px 8px rgba(0, 0, 0, 0.08)` for subtle elevation
- Rounded corners: `12px` for cards, `16px` for modals
- White backgrounds (`#ffffff`) on soft teal/gray backgrounds (`#e5f3f7` or `#f5f7fa`)

**Spacing & Breathing Room:**
- Generous padding: `1.5rem` to `2rem` inside cards
- Section spacing: `2rem` to `3rem` between major sections
- Content max-width: `1200px` centered for optimal readability
- Avoid cramped layouts - give elements room to breathe

**Typography Hierarchy:**
- Large, bold headings: `1.75rem` to `2rem` for page titles
- Section headings: `1.25rem` to `1.5rem` with `font-weight: 600`
- Body text: `1rem` with `line-height: 1.6` for readability
- Use font-weight variations (400, 500, 600, 700) to create hierarchy

#### Color & Visual Appeal

**Background Gradients:**
- Subtle gradients for backgrounds: `linear-gradient(135deg, #f5f7fa 0%, #e5f3f7 100%)`
- Card backgrounds: Pure white (`#ffffff`) for contrast
- Soft teal accents: `#e5f3f7` for subtle highlights

**Accent Colors:**
- Primary teal (`--ct-primary`) for primary actions and highlights
- Use color sparingly - let white space and typography do the work
- Status colors for indicators (success, warning, error)

**Shadows & Depth:**
- Subtle shadows create depth: `0 1px 3px rgba(0, 0, 0, 0.1)` for cards
- Hover states: `0 4px 12px rgba(0, 0, 0, 0.15)` for interactive elements
- Layered shadows: Multiple shadow layers for premium feel

#### Interactive Elements

**Buttons:**
- Rounded buttons: `border-radius: 8px` to `12px`
- Smooth transitions: `transition: all 0.2s ease`
- Hover effects: Slight scale (`transform: translateY(-1px)`) and shadow increase
- Active states: `transform: scale(0.98)` for tactile feedback

**Cards & Tiles:**
- Hover effects: Subtle lift with `transform: translateY(-2px)`
- Cursor pointer for clickable cards
- Smooth transitions on all interactive elements
- Border on hover: `border: 1px solid var(--ct-primary)` for selected states

**Tables:**
- Clean, minimal design with subtle borders
- Row hover: Light background change (`#f9fafb`)
- Alternating row colors (optional): Very subtle (`#fafbfc`)
- Sticky headers with subtle shadow

#### Premium Details

**Icons & Visual Elements:**
- Consistent icon size: `1.25rem` (20px) for standard icons
- Icon spacing: `0.5rem` gap between icon and text
- SVG icons with proper stroke width (2px)
- Icon colors match text color or use semantic colors

**Status Indicators:**
- Badge-style indicators with rounded corners
- Color-coded: Green (success), Orange (warning), Red (error), Blue (info)
- Small, subtle badges: `padding: 0.25rem 0.75rem`, `border-radius: 999px`
- Font size: `0.75rem` for badges

**Loading States:**
- Smooth loading animations
- Skeleton screens for content loading
- Spinner animations with brand colors
- Progress indicators with gradient fills

**Empty States:**
- Friendly, helpful empty state messages
- Large, subtle icons (2rem to 3rem)
- Clear call-to-action buttons
- Soft background colors

#### Dashboard-Specific Elements

**Stats Cards:**
- Large, bold numbers: `2rem` to `3rem` font size
- Subtle background gradients or colors
- Icon or visual indicator
- Hover effect for clickable stats
- Border accent: `border-left: 4px solid var(--ct-primary)`

**Data Tables:**
- Clean, minimal design
- Sortable headers with hover states
- Action buttons in rows (small, subtle)
- Responsive: Horizontal scroll on mobile
- Sticky header on scroll

**Forms:**
- Clean input fields with subtle borders
- Focus states: Border color change and subtle shadow
- Label styling: `font-weight: 500`, `color: var(--ct-text-primary)`
- Help text: Smaller, muted color
- Error states: Red border and error message

**Modals:**
- Centered with backdrop blur effect
- Smooth slide-in animation
- Rounded corners: `16px` to `20px`
- Shadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25)`
- Header with gradient background (optional)

#### Premium Polish

**Micro-interactions:**
- Smooth transitions on all state changes
- Hover effects on interactive elements
- Loading states with animations
- Success/error feedback animations

**Consistency:**
- Consistent spacing throughout
- Unified color palette
- Consistent border radius values
- Uniform shadow styles

**Performance:**
- Smooth 60fps animations
- Optimized images and assets
- Lazy loading for content
- Efficient CSS (avoid expensive properties)

**Accessibility:**
- Proper contrast ratios
- Focus indicators
- Keyboard navigation
- Screen reader support

#### Code Examples

**Premium Card:**
```css
.premium-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.2s ease;
}

.premium-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

**Premium Button:**
```css
.premium-button {
    background: var(--ct-primary);
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(11, 114, 133, 0.2);
    transition: all 0.2s ease;
}

.premium-button:hover {
    background: var(--ct-primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(11, 114, 133, 0.3);
}

.premium-button:active {
    transform: scale(0.98);
}
```

**Premium Stats Card:**
```css
.stat-card-premium {
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-radius: 12px;
    padding: 1.5rem;
    border-left: 4px solid var(--ct-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.2s ease;
}

.stat-card-premium:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--ct-primary);
    line-height: 1;
    margin-bottom: 0.5rem;
}

.stat-label {
    font-size: 0.875rem;
    color: var(--ct-text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
```

### 8.7 Current UI Design Details

#### Dashboard Layout Structure

**Header:**
- Teal background (`#0b7285`) with white text
- Logo on the left, navigation on the right
- Hamburger menu on mobile/tablet
- Sticky header (stays at top on scroll)
- Height: ~60px to 70px

**Sidebar Navigation (if applicable):**
- White background with subtle border
- Active state: Teal background or border accent
- Icon + text labels
- Collapsible on mobile

**Main Content Area:**
- Soft background: `#e5f3f7` or `#f5f7fa`
- Max-width container: `1200px` centered
- Padding: `2rem` on desktop, `1rem` on mobile
- Card-based layout for sections

**Dashboard Grid:**
- Stats cards in responsive grid
- 4 columns on desktop, 2 on tablet, 1 on mobile
- Gap: `1rem` to `1.5rem` between cards
- Cards have white background with shadows

#### Current Color Usage

**Primary Teal:**
- Main brand color: `#0b7285`
- Used for: Headers, primary buttons, links, accents
- Hover: `#095a69` (darker teal)

**Background Colors:**
- Page background: `#e5f3f7` (soft teal) or `#f5f7fa` (light gray)
- Card background: `#ffffff` (white)
- Hover states: `#f9fafb` (very light gray)

**Text Colors:**
- Primary text: `#111827` or `#1f2937` (dark gray)
- Secondary text: `#6b7280` (medium gray)
- Muted text: `#9ca3af` (light gray)

**Status Colors:**
- Success: `#059669` (green)
- Warning: `#d97706` (orange)
- Error: `#dc2626` (red)

#### Current Component Styles

**Cards:**
- White background
- Border radius: `12px`
- Padding: `1.25rem` to `1.5rem`
- Shadow: `0 1px 3px rgba(0, 0, 0, 0.1)`
- Hover: Slight lift with increased shadow

**Buttons:**
- Primary: Teal background, white text, `8px` border radius
- Secondary: Gray background, white text
- Outline: Transparent with teal border
- Padding: `0.75rem 1.5rem`
- Font weight: `600`

**Tables:**
- Clean white background
- Subtle borders: `#e5e7eb`
- Header: Light gray background `#f9fafb`
- Row hover: `#f9fafb` background
- Padding: `1rem` in cells

**Forms:**
- Input border: `#d1d5db`
- Border radius: `8px`
- Focus: Teal border `var(--ct-primary)` with shadow
- Padding: `0.6rem 0.75rem`

**Modals:**
- White background
- Border radius: `16px` to `20px`
- Shadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25)`
- Max width: `600px` (standard), `800px` (large)
- Backdrop: `rgba(0, 0, 0, 0.5)` with optional blur

#### Current Typography

**Font Stack:**
- Primary: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Fallback: Standard sans-serif fonts

**Font Sizes:**
- Page title: `1.75rem` to `2rem` (28px to 32px)
- Section heading: `1.25rem` to `1.5rem` (20px to 24px)
- Body text: `1rem` (16px)
- Small text: `0.875rem` (14px)
- Tiny text: `0.75rem` (12px)

**Font Weights:**
- Bold headings: `700`
- Section headings: `600`
- Body text: `400`
- Medium emphasis: `500`

#### Current Spacing System

- Base unit: `1rem` (16px)
- Small: `0.5rem` (8px)
- Medium: `1rem` (16px)
- Large: `1.5rem` (24px)
- Extra large: `2rem` (32px)
- Section spacing: `2rem` to `3rem`

#### Current Interactive States

**Hover:**
- Buttons: Darker background, slight lift
- Cards: Lift with shadow increase
- Links: Underline or color change
- Transitions: `0.2s` to `0.3s` ease

**Active:**
- Buttons: Scale down (`scale(0.98)`)
- Cards: Slight press effect

**Focus:**
- Outline: Teal border or ring
- Shadow: Subtle glow effect

**Disabled:**
- Reduced opacity: `0.6`
- Gray background: `#e5e7eb`
- No pointer cursor

### 8.8 Design System Summary

- **Primary Color:** `#0b7285` (teal) - Use `var(--ct-primary)`
- **Font Stack:** System UI (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- **Font Sizes:** Use `clamp()` for responsive typography
- **Spacing:** Consistent padding/margin scale (0.5rem, 1rem, 1.5rem, 2rem, etc.)
- **Border Radius:** 8px (standard), 12px (cards), 16px (modals), 999px (pill buttons)
- **Shadows:** Subtle shadows for elevation (`0 2px 4px rgba(0,0,0,0.1)`)
- **Buttons:** Use standardized `.btn` classes (see section 8.3)
- **Modals:** Use standardized `.modal` structure (see section 8.4)
- **Responsive:** Mobile-first design with breakpoints (see section 8.5)
- **PWA:** Full PWA support with icons and splash screens
- **Mobile-First:** All components designed mobile-first, then enhanced for larger screens

---

## 9. Development Workflow

### 9.1 Local Development

```bash
# Install dependencies
npm install

# Run local server (if configured)
npm run dev

# Firebase emulators (for local testing)
firebase emulators:start
```

### 9.2 Firebase Deployment

```bash
# Deploy hosting
firebase deploy --only hosting

# Deploy functions
firebase deploy --only functions

# Deploy everything
firebase deploy
```

### 9.3 Environment Configuration

- **Firebase Config:** `firebase-config.js` (public, safe to expose)
- **Functions Config:** `firebase functions:config:set` or `.env` file
- **Required Config:**
  - SendGrid API key (email)
  - Twilio credentials (optional, SMS)
  - Admin email

---

---

## 9. Authentication & Security

### 9.1 Authentication Flow

- **Entry Point:** `login.html` (redirects from `index.html` on app domain)
- **Auth Guard:** `dashboard-auth.js` protects all dashboard pages
- **Role-Based Routing:** Users redirected to appropriate dashboard based on role
- **Dev Mode:** Add `?dev=true` to bypass authentication for development

### 9.2 Access Control

- **Client Role:** Can access user dashboard, manage own data
- **Practitioner Role:** Can access practitioner dashboard, manage clients
- **Admin Role:** Can access admin dashboard, approve practitioners
- **Route Protection:** All dashboards check authentication and role before allowing access

---

## 10. Architecture Notes

### 10.1 Code Organization

The application currently uses a monolithic structure where some HTML files contain thousands of lines with inline CSS and JavaScript. This includes:
- `practitioner-dashboard.html` (~7,000+ lines)
- `user-dashboard.html` (~3,500+ lines)

These large files contain all styles and scripts inline, which impacts maintainability but ensures all dependencies are self-contained.

### 10.2 Design System Consistency

The application maintains consistency through:
- **Global structure pattern** - All pages follow the same layout structure (see section 1.2)
- **Unified stylesheets** - `global-styles.css` and `css/ct-theme.css` provide base styles
- **CSS variables** - Color system uses CSS variables for easy theming
- **Component patterns** - Standardized buttons, modals, and form elements
- **Responsive design** - Mobile-first approach with consistent breakpoints

### 10.2 Data Storage Strategy

- **Primary:** Firestore (source of truth)
- **Secondary:** localStorage (cache/offline)
- **Sync:** `shared-data.js` handles synchronization
- **Note:** Be careful with data consistency between stores

### 10.3 Authentication

- All dashboards protected by `dashboard-auth.js`
- Role-based access control enforced
- Dev mode available: `?dev=true` in URL

### 10.4 PWA Features

- Only active on `app.cleartrack.co.za` domain
- Service worker: `sw.js`
- Manifest: `manifest.json`
- Icons: Multiple sizes in `/icons/`
- Splash screens: Device-specific in `/splash/`

### 10.5 Error Handling

- Extensive console logging for debugging
- Fallback to localStorage when Firestore unavailable
- Error messages displayed to users

---

---

## 11. Development & Deployment

### 11.1 Local Development

The application can be run locally using:
- Firebase emulators for backend functions and Firestore
- Local server for frontend (if configured)
- Development mode can bypass authentication using `?dev=true` URL parameter

### 11.2 Deployment

Deployment is handled through Firebase:
- **Hosting:** `firebase deploy --only hosting` deploys all frontend files
- **Functions:** `firebase deploy --only functions` deploys Cloud Functions
- **Full deployment:** `firebase deploy` deploys everything

### 11.3 Environment Configuration

- **Firebase Config:** Public configuration in `firebase-config.js`
- **Functions Config:** Environment variables set via `firebase functions:config:set` or `.env` file
- **Required Services:** SendGrid (email), Twilio (optional SMS), Admin email configuration

---

---

## 12. Testing & Debugging

### 12.1 Development Mode

The application supports a development mode that bypasses authentication:
- Add `?dev=true` to any URL
- Or set `localStorage.setItem('devMode', 'true')` in browser console

### 12.2 Debugging Tools

- **Console Logging:** Extensive logging throughout with `[DEBUG]` and `🔍 DEBUG` prefixes
- **Firebase Console:** Monitor Firestore data, Cloud Functions logs, and authentication events
- **Browser DevTools:** Standard debugging tools for frontend issues

---

---

## 13. Key Technical Details

### 13.1 Design System Components

The application uses a unified design system:
- **Global Structure:** Consistent page layout across all pages
- **Color System:** CSS variable-based color palette
- **Button System:** Standardized button components with variants
- **Modal System:** Consistent modal structure and behavior
- **Typography:** System UI font stack with responsive sizing
- **Mobile-First Design:** Fully responsive with mobile-first approach
- **Responsive Breakpoints:** Mobile (< 481px), Tablet (481px - 768px), Desktop (> 768px)
- **Touch Optimization:** All interactive elements optimized for touch (minimum 44px targets)
- **PWA Support:** Installable on mobile devices with offline capabilities

### 13.2 Data Flow

The application uses a dual storage strategy:
- **Primary Storage:** Firestore (cloud database) - source of truth
- **Secondary Storage:** localStorage (browser cache) - for offline support
- **Synchronization:** `shared-data.js` handles syncing between both stores
- **Real-time Updates:** Firestore listeners provide live data updates
- **Offline Support:** localStorage provides fallback when Firestore unavailable

---

---

## 14. Additional Resources

- **Firebase Documentation:** https://firebase.google.com/docs
- **Project Analysis:** `APP_ANALYSIS.md` contains detailed code analysis
- **Connection Flow:** `CONNECTION_FLOW_ANALYSIS.md` documents the client-practitioner connection system
- **Firestore Rules:** Security rules defined in `firestore.rules`

---

**Document Purpose:** This brief provides a comprehensive overview of the ClearTrack application architecture, features, and design system for developers who need to understand the codebase.

**Last Updated:** 2025-01-XX  
**Version:** 2.0

