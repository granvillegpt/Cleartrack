#!/bin/bash

# Deploy to Staging - Both Projects
# This script deploys to staging for both Firebase projects

set -e  # Exit on error

echo "🚀 Starting staging deployment..."
echo ""

# Get the project directory
PROJECT_DIR="/Users/granville/Desktop/Cleartrack App 9"
cd "$PROJECT_DIR"

# Deploy to cleartrack-hosting staging
echo "📦 Deploying to cleartrack-hosting staging..."
npx firebase use cleartrack-hosting
npx firebase deploy --only hosting:staging

echo ""
echo "✅ cleartrack-hosting staging deployment complete!"
echo ""

# Deploy to cleartrack-1f6c6 staging
echo "📦 Deploying to cleartrack-1f6c6 staging..."
npx firebase use cleartrack-1f6c6
npx firebase deploy --only hosting:staging

echo ""
echo "✅ cleartrack-1f6c6 staging deployment complete!"
echo ""
echo "🎉 All staging deployments complete!"
echo ""
echo "🌐 Staging URLs:"
echo "   https://cleartrack-staging.web.app"
echo "   https://cleartrack-staging.firebaseapp.com"

