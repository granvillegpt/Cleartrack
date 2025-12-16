# Firebase Deployment Guide for ClearTrack

## Prerequisites

1. **Firebase CLI installed**: If not installed, run:
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase**: 
   ```bash
   firebase login
   ```

3. **Projects configured**: Your `.firebaserc` shows two projects:
   - `cleartrack-1f6c6` (default)
   - `cleartrack-hosting` (host)

## Quick Deployment

### Deploy Everything (Hosting + Firestore Rules)

```bash
# Deploy to default project (cleartrack-1f6c6)
firebase deploy

# OR deploy to hosting project specifically
firebase use host
firebase deploy
```

### Deploy Individual Components

#### 1. Deploy Hosting Only (Web App)
```bash
firebase deploy --only hosting
```

#### 2. Deploy Firestore Rules Only
```bash
firebase deploy --only firestore:rules
```

#### 3. Deploy Cloud Functions (Optional - requires Blaze plan)
```bash
cd functions
npm install  # Install dependencies first
cd ..
firebase deploy --only functions
```

## Deployment Steps

### Step 1: Verify Firebase Login
```bash
firebase login
firebase projects:list
```

### Step 2: Select Project
```bash
# Use default project
firebase use default

# OR use hosting project
firebase use host
```

### Step 3: Deploy
```bash
# Deploy hosting and rules
firebase deploy --only hosting,firestore:rules
```

### Step 4: Verify Deployment
After deployment, Firebase will provide URLs like:
- Hosting URL: `https://cleartrack-1f6c6.web.app` or `https://cleartrack-1f6c6.firebaseapp.com`
- Custom domain: `https://app.cleartrack.co.za` (if configured)

## Current Configuration

### Firebase Hosting
- **Public directory**: `public/`
- **Configuration**: `firebase.json`
- **Status**: ✅ Ready to deploy

### Firestore Rules
- **Rules file**: `firestore.rules`
- **Status**: ✅ Configured (unrestricted access mode)
- **Note**: Rules allow full access for authenticated users

### Cloud Functions
- **Source**: `functions/`
- **Status**: ⏸️ Prepared but not deployed (requires Blaze plan)
- **Note**: Functions are optional and not required for basic functionality

## Deployment Checklist

Before deploying, ensure:

- [ ] All recent changes are saved
- [ ] Firebase CLI is installed and logged in
- [ ] Correct project is selected (`firebase use`)
- [ ] No syntax errors in code
- [ ] `firebase.json` is correctly configured
- [ ] `firestore.rules` are as intended

## Post-Deployment

1. **Test the deployed app**:
   - Visit the hosting URL
   - Test login/registration
   - Verify Firestore connections
   - Check PWA functionality

2. **Monitor**:
   ```bash
   # View hosting logs
   firebase hosting:channel:list
   
   # View function logs (if deployed)
   firebase functions:log
   ```

3. **Rollback if needed**:
   ```bash
   firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL_ID TARGET_SITE_ID:live
   ```

## Troubleshooting

### Common Issues

1. **"Permission denied"**:
   - Run `firebase login` again
   - Verify project access in Firebase Console

2. **"Project not found"**:
   - Check `.firebaserc` project IDs
   - Verify projects exist in Firebase Console

3. **Deployment fails**:
   - Check `firebase.json` syntax
   - Verify `public/` directory exists
   - Check file sizes (Firebase has limits)

4. **Functions deployment fails**:
   - Ensure Blaze plan is enabled
   - Run `npm install` in `functions/` directory
   - Check Node.js version (requires 18)

## Custom Domain Setup

If you have a custom domain (`app.cleartrack.co.za`):

1. Go to Firebase Console → Hosting
2. Add custom domain
3. Follow DNS configuration instructions
4. SSL certificate will be provisioned automatically

## Notes

- **Hosting is free** on Firebase (Spark plan)
- **Firestore** has free tier limits
- **Cloud Functions** require Blaze plan (pay-as-you-go)
- **Deployment is fast** - usually completes in 1-2 minutes
- **Rollbacks** are available if needed

## Quick Commands Reference

```bash
# Login
firebase login

# List projects
firebase projects:list

# Select project
firebase use default
firebase use host

# Deploy everything
firebase deploy

# Deploy hosting only
firebase deploy --only hosting

# Deploy rules only
firebase deploy --only firestore:rules

# View deployment history
firebase hosting:channel:list

# Open Firebase Console
firebase open
```





