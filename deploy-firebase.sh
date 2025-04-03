#!/bin/bash

# Make sure Firebase CLI is installed
# npm install -g firebase-tools

# Log in to Firebase (if not already logged in)
firebase login

# Deploy Firebase configuration
echo "Deploying Firebase configuration..."
firebase deploy --only firestore:rules,storage:rules

# Deploy CORS configuration for storage
echo "Configuring CORS for Storage..."
firebase deploy --only storage:cors

# Deploy Firestore indexes
echo "Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

echo "Deployment complete! You may now test your application."
echo "Note: If you continue to encounter CORS issues, you might need to wait a few minutes for CORS settings to propagate." 