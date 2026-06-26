#!/bin/bash
set -e

echo "===================================================="
echo "🔄 Starting PO Token provider server on port 4416..."
echo "===================================================="

# Start the bgutil POT provider HTTP server in the background
# This generates Proof-of-Origin tokens to bypass YouTube bot checks
bgutil-pot server &
POT_PID=$!

# Wait a moment for the POT server to initialize
sleep 3

echo "===================================================="
echo "🔄 Generating fresh YouTube cookies from this server IP..."
echo "===================================================="

# Generate cookies from within the container so they match this server's IP
node get_cookies.js || echo "⚠ Cookie generation failed, will proceed without cookies"

echo "===================================================="
echo "🚀 Starting OmniDownloader server..."
echo "===================================================="

exec npm start
