#!/bin/bash

# Make sure Firebase CLI is installed
# npm install -g firebase-tools

# Login to Firebase (if not already logged in)
firebase login

# Deploy storage rules
firebase deploy --only storage 