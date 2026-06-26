#!/bin/bash
set -e

echo "===================================================="
echo "🔄 Generating fresh YouTube cookies from this server IP..."
echo "===================================================="

# Generate cookies from within the container so they match this server's IP
node get_cookies.js || echo "⚠ Cookie generation failed, will proceed without cookies"

echo "===================================================="
echo "🚀 Starting OmniDownloader server..."
echo "===================================================="

exec npm start
