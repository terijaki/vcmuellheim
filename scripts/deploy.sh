#!/bin/bash

set -e

# Start timing
START_TIME=$(date +%s)

# Load environment variables from .env.deploy.local if it exists
if [ -f ".env.deploy.local" ]; then
    echo "📄 Loading environment variables from .env.deploy.local"
    export $(grep -v '^#' .env.deploy.local | xargs)
fi

# Configuration
GITHUB_USERNAME="terijaki"
REPO_NAME="vcmuellheim"
IMAGE_NAME="ghcr.io/${GITHUB_USERNAME}/${REPO_NAME}"
TAG=${1:-latest}
COOLIFY_WEBHOOK="https://cool.terijaki.eu/api/v1/deploy?uuid=zws880wk8o8wcsgg88kckcoc&force=false"
COOLIFY_TOKEN=${COOLIFY_TOKEN}

echo "🚀 Building and deploying ${REPO_NAME} to GitHub Container Registry"

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN environment variable is not set"
    echo "Please set it with: export GITHUB_TOKEN=your_github_token"
    exit 1
fi

# Check if Coolify token is set
if [ -z "$COOLIFY_TOKEN" ]; then
    echo "❌ Error: COOLIFY_TOKEN environment variable is not set"
    exit 1
fi

# Login to GitHub Container Registry
echo "🔐 Logging in to GitHub Container Registry..."
echo $GITHUB_TOKEN | podman login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Build the Container image
echo "🏗️ Building Container image..."

# Build with secrets
podman build \
    --memory=6g \
    -t ${IMAGE_NAME}:${TAG} .

# Tag as latest if not already
if [ "$TAG" != "latest" ]; then
    podman tag ${IMAGE_NAME}:${TAG} ${IMAGE_NAME}:latest
fi

# Push the image
echo "📤 Pushing image to registry..."
podman push ${IMAGE_NAME}:${TAG}

if [ "$TAG" != "latest" ]; then
    podman push ${IMAGE_NAME}:latest
fi

echo "✅ Successfully deployed ${IMAGE_NAME}:${TAG}"

# Trigger Coolify deployment
echo "🔄 Triggering Coolify deployment..."
RESPONSE=$(curl -s -w "%{http_code}" -o /tmp/coolify_response \
  -X POST \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_WEBHOOK")

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "204" ]; then
    echo "✅ Coolify deployment triggered successfully"
else
    echo "⚠️ Coolify deployment failed with status: $RESPONSE"
    cat /tmp/coolify_response
fi

# Clean up temporary file
rm -f /tmp/coolify_response

# Calculate and display total time
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_TIME / 60))
SECONDS=$((TOTAL_TIME % 60))

echo ""
echo "⏱️  Total deployment time: ${MINUTES}m ${SECONDS}s"
echo "https://vcmuellheim.de"
echo ""