#!/bin/bash

# Verbose Staging Deployment Script
set -e

PROJECT_DIR="/Users/granville/Desktop/Cleartrack App 9"
cd "$PROJECT_DIR"

echo "=========================================="
echo "Staging Deployment Script"
echo "=========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
    echo ""
fi

# Check Firebase CLI
echo "Checking Firebase CLI..."
if ! npx firebase --version > /dev/null 2>&1; then
    echo "❌ Firebase CLI not found. Please run: npm install"
    exit 1
fi
echo "✅ Firebase CLI found"
echo ""

# Deploy to cleartrack-hosting
echo "=========================================="
echo "Deploying to cleartrack-hosting staging..."
echo "=========================================="
npx firebase use cleartrack-hosting
echo ""
npx firebase deploy --only hosting:staging
echo ""

# Deploy to cleartrack-1f6c6
echo "=========================================="
echo "Deploying to cleartrack-1f6c6 staging..."
echo "=========================================="
npx firebase use cleartrack-1f6c6
echo ""
npx firebase deploy --only hosting:staging
echo ""

echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "🌐 Staging URLs:"
echo "   https://cleartrack-staging.web.app"
echo "   https://cleartrack-staging.firebaseapp.com"
echo ""


