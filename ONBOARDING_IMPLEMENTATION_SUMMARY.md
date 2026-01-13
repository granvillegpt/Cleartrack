# Onboarding Page Implementation Summary

## Deliverables

1. ✅ `/public/onboarding.html` created and wired up to existing functions
2. ✅ Minimal refinements in existing JS (with clear comments "REFINED FOR ONBOARDING PAGE")
3. ✅ List of reused components/functions and what changed

---

## Step 1 — Repository Search Results

### A) Reuse as-is

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| `firebaseApi.saveData()` | `firebase-api.js` | 166-185 | Saves user data to Firestore with role protection |
| `cleartrackData.getPractitionerByCode()` | `shared-data.js` | 192-245 | Looks up practitioner by code (Firestore + localStorage fallback) |
| `cleartrackData.sendConnectionRequest()` | `shared-data.js` | 1130-1216 | Creates connection request (Firestore + localStorage fallback) |
| `firestoreData.sendConnectionRequest()` | `firestore-data.js` | 243-290 | Firestore implementation of connection request |
| `cleartrackData.connectUserToPractitioner()` | `shared-data.js` | 258-310 | Connects user to practitioner |
| `window.isProfileReady()` | `firebase-init.js` | 84-89 | Checks if user has role and migrationComplete |
| `normalizeRole()` | `auth-redirect-controller.js` | 110-113 | Normalizes "user" → "client" |

### B) Reuse with small refinement

| Component | File | Lines | Refinement Made |
|-----------|------|-------|----------------|
| `getRedirectDestination()` | `auth-redirect-controller.js` | 122-135 | **REFINED**: Added `onboardingState` parameter check. If `onboardingState !== 'ACTIVE'`, route to `/onboarding.html` instead of `/user-dashboard.html` |
| `initializeAuthRedirect()` | `auth-redirect-controller.js` | 230-245 | **REFINED**: Added `onboardingState` extraction from user document |
| `initializeAuthRedirect()` | `auth-redirect-controller.js` | 268-271 | **REFINED**: Pass `onboardingState` to `getRedirectDestination()` call |

### C) Missing (created once)

| Component | Description | Location |
|-----------|-------------|----------|
| `findMatchingPractitionerSimple()` | Deterministic practitioner selection when no practitionerId provided. Reuses logic from `admin-dashboard.html` `findMatchingPractitioner()` but simplified for onboarding page | `onboarding.html` (lines 420-470) |

---

## Step 2 — Onboarding Page Implementation

### File: `/public/onboarding.html`

**Features:**
1. ✅ Role selection (sales_rep, employee, contractor, business_owner) - saves to `clientRole` field
2. ✅ Profile information collection (firstName, lastName, phone, taxNumber) - sets `profileComplete=true`
3. ✅ Practitioner connection:
   - If practitioner code provided: Uses `cleartrackData.getPractitionerByCode()` + `cleartrackData.sendConnectionRequest()`
   - If no code: Shows questionnaire, uses `CTClientLinking.createClientRequest()` or `findMatchingPractitionerSimple()` fallback
4. ✅ Real-time status display:
   - NEW / PROFILE_PENDING / MATCHING / CONNECTION_PENDING / ACTIVE / ESCALATED
   - Shows pending, rejected (with retry count), escalated messages
5. ✅ Auto-redirect to `user-dashboard.html` when `onboardingState === 'ACTIVE'` or `connectionStatus === 'approved'`

**Data Contract:**
- Uses existing Firestore fields: `role`, `clientRole`, `profileComplete`, `practitionerId`, `connectionStatus`, `rejectionCount`
- Adds new field: `onboardingState` (NEW | PROFILE_PENDING | MATCHING | CONNECTION_PENDING | ACTIVE | ESCALATED)
- Preserves `migrationComplete` untouched

---

## Step 3 — Routing Refinements

### File: `public/js/auth-redirect-controller.js`

**Changes Made:**

1. **Function signature update** (line 124):
   ```javascript
   // BEFORE:
   function getRedirectDestination(role, profileReady = false)
   
   // AFTER:
   function getRedirectDestination(role, profileReady = false, onboardingState = null)
   ```

2. **Routing logic update** (lines 129-133):
   ```javascript
   // BEFORE:
   if (normalizeRole(role) === 'client') {
     return '/user-dashboard.html';
   }
   
   // AFTER:
   if (normalizeRole(role) === 'client') {
     // REFINED FOR ONBOARDING PAGE: Route to onboarding if not ACTIVE
     if (onboardingState && onboardingState !== 'ACTIVE') {
       return '/onboarding.html';
     }
     return '/user-dashboard.html';
   }
   ```

3. **State extraction** (lines 230-245):
   - Added `let onboardingState = null;`
   - Extract `onboardingState` from user document: `onboardingState = userData.onboardingState || null;`

4. **Function call update** (line 271):
   ```javascript
   // BEFORE:
   const destination = getRedirectDestination(role, profileReady);
   
   // AFTER:
   const destination = getRedirectDestination(role, profileReady, onboardingState);
   ```

**Routing Logic:**
- If `role === 'practitioner'` → `/practitioner-dashboard.html`
- If `role === 'admin'` → `/admin-dashboard.html`
- Else if `role === 'client'`:
  - If `onboardingState !== 'ACTIVE'` → `/onboarding.html`
  - Else → `/user-dashboard.html`
- Default → `/user-dashboard.html`

---

## Files Modified

1. **`/public/onboarding.html`** (NEW FILE)
   - Complete onboarding UI implementation
   - Reuses existing functions from `shared-data.js`, `firestore-data.js`, `firebase-api.js`, `client-linking.js`

2. **`/public/js/auth-redirect-controller.js`** (REFINED)
   - Lines 122-135: Updated `getRedirectDestination()` to check `onboardingState`
   - Lines 230-245: Extract `onboardingState` from user document
   - Line 271: Pass `onboardingState` to `getRedirectDestination()`

---

## Integration Notes

- **No dashboard changes**: As requested, no onboarding UI was added to `user-dashboard.html`, `practitioner-dashboard.html`, or `admin-dashboard.html`
- **No duplicate functions**: All existing functions are reused; only one new helper (`findMatchingPractitionerSimple`) was created
- **Minimal routing changes**: Only the necessary refinements in `auth-redirect-controller.js` with clear comments
- **Real-time updates**: Onboarding page uses Firestore real-time listener to detect state changes and auto-redirect when complete

---

## Testing Checklist

- [ ] New user signup → lands on onboarding page
- [ ] Role selection saves to Firestore
- [ ] Profile completion saves to Firestore
- [ ] Practitioner code connection works
- [ ] Questionnaire matching works
- [ ] Status banner displays correctly for pending/rejected/escalated
- [ ] Auto-redirect to dashboard when `onboardingState === 'ACTIVE'`
- [ ] Routing logic correctly sends incomplete users to onboarding
- [ ] Routing logic correctly sends complete users to dashboard



