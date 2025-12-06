# Cleartrack Application - Project Rules and Guidelines

## Core Principles

### 1. **Holistic Application Approach**
- Always treat the application as a complete, interconnected system
- Before making changes, consider impact on all modules and functionalities
- Test complete user flows, not just individual components
- Avoid breaking existing functionality when adding new features

### 2. **No Cloud Functions Dependency (Current Phase)**
- The application should work entirely with **localStorage** and **Firebase Authentication**
- Do NOT rely on Cloud Functions for core functionality
- Cloud Functions are prepared for future use but not required now
- All client management, invites, and data operations should use `cleartrackData` (localStorage)

### 3. **Unrestricted Production Access**
- During production/development phase, maintain unrestricted access to all modules
- Firestore security rules are set to allow full read/write for authenticated users
- This enables unrestricted app modifications without security review process
- Rules can be tightened later when security review is needed

## Technical Guidelines

### 4. **Data Management**
- Use `cleartrackData` (CleartrackDataManager) for all localStorage operations
- Always check if `window.cleartrackData` is available before using it
- Ensure `CleartrackDataManager` class is properly exposed globally via `window.CleartrackDataManager`
- Initialize data manager early in the application lifecycle

### 5. **Global Function Accessibility**
- All critical functions must be accessible via `window` object
- Functions called from HTML `onclick` attributes must be globally accessible
- Examples: `window.showAddClientModal()`, `window.handleAddClientFormSubmit()`, `window.updateDashboard()`

### 6. **Practitioner Variable Handling**
- Practitioner data may be stored in both local variable and `window.practitioner`
- Always check both: `const currentPractitioner = practitioner || window.practitioner`
- Ensure practitioner is loaded before performing operations that require it

### 7. **Error Handling**
- Provide clear, actionable error messages
- Log errors to console with context for debugging
- Check for method/object existence before calling
- Use defensive programming: verify objects exist before accessing properties

### 8. **Client Management Flow**
- Add Client Modal → Creates invite in localStorage → Displays invite link
- Pending clients appear in client list with "Pending Registration" status
- Client uses invite link → Auto-connects to practitioner → Moves to "Connected" status
- Always refresh client list after adding a client

## Tab Functionality Requirements

### 9. **All Tabs Must Function**
- Dashboard: Stats, overview, recent activity
- Clients: Add, view, manage clients (with pending/connected states)
- Messages: Conversation management
- Requests: Connection request handling
- Tax Returns: Tax return tracking and management
- Invoices: Invoice generation and management
- Profile: Practitioner profile editing

### 10. **Tab Navigation**
- Each tab should load its data when clicked
- Use `showSection()` function to switch tabs
- Ensure all data loading functions are called when tabs are activated
- Verify functions exist before calling them

## Code Quality Standards

### 11. **Syntax and Structure**
- Always verify JavaScript syntax before deploying
- Use proper scoping for classes and functions
- Ensure closing braces match opening braces
- Test syntax with `node -c` before deployment

### 12. **Testing Before Deployment**
- Check for linter errors
- Verify all functions are accessible
- Test complete user flows
- Ensure no regressions in existing functionality

## Deployment Process

### 13. **Deployment Steps**
- Fix all syntax errors
- Run linter checks
- Deploy to both Firebase projects:
  - `cleartrack-hosting`
  - `cleartrack-1f6c6`
- Verify deployment success

## Common Issues and Solutions

### 14. **"Method is not a function" Errors**
- Check if method exists on the object
- Verify object is initialized before use
- Ensure proper scoping (use `window` for global access)

### 15. **"Practitioner not loaded" Errors**
- Check both `practitioner` and `window.practitioner`
- Ensure practitioner initialization completes before form submission
- Add proper error handling and user feedback

### 16. **"CleartrackDataManager is not defined"**
- Ensure class is assigned to `window.CleartrackDataManager`
- Verify class definition is complete and properly closed
- Check for syntax errors in shared-data.js

## File Structure

### 17. **Key Files**
- `public/practitioner-dashboard.html` - Main practitioner interface
- `public/shared-data.js` - localStorage data management
- `public/login.js` - Authentication and invite processing
- `firestore.rules` - Database security rules (currently unrestricted)
- `functions/index.js` - Cloud Functions (prepared for future use)

## Communication Guidelines

### 18. **When Reporting Issues**
- Provide console error messages
- Describe the complete user flow that failed
- Include any relevant error screenshots
- Specify which tab/functionality is affected

### 19. **When Requesting Changes**
- Be specific about desired behavior
- Consider impact on other parts of the application
- Request holistic testing of related functionality
- Verify no regressions are introduced

---

**Last Updated:** 2025-01-XX
**Status:** Active Development Phase
**Cloud Functions:** Prepared but not required
**Data Storage:** localStorage + Firebase Authentication

