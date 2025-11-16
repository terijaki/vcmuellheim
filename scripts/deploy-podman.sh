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
PODMAN_MACHINE_NAME="vcmuellheim-builder"
# Get current commit SHA for unique tagging
COMMIT_SHA=$(git rev-parse --short HEAD)
TAG=${1:-$COMMIT_SHA}
COOLIFY_WEBHOOK="https://cool.terijaki.eu/api/v1/deploy?uuid=zws880wk8o8wcsgg88kckcoc&force=false"
COOLIFY_TOKEN=${COOLIFY_TOKEN}

# Check if Podman machine exists, create if it doesn't
if ! podman machine list 2>/dev/null | grep -q "${PODMAN_MACHINE_NAME}"; then
    echo "🔧 Creating Podman machine '${PODMAN_MACHINE_NAME}'..."
    podman machine init ${PODMAN_MACHINE_NAME} --memory=10240 --cpus=4 --disk-size=50
fi

# Start Podman machine (if not already running)
MACHINE_STATUS=$(podman machine list --format "{{.Name}} {{.Running}}" 2>/dev/null | grep "${PODMAN_MACHINE_NAME}" || echo "")
if [[ "$MACHINE_STATUS" != *"true"* ]]; then
    echo "▶️ Starting Podman machine '${PODMAN_MACHINE_NAME}'..."
    podman machine start ${PODMAN_MACHINE_NAME}
else
    echo "✓ Podman machine '${PODMAN_MACHINE_NAME}' is already running"
fi

# Set the active connection to the machine
podman system connection default ${PODMAN_MACHINE_NAME}

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
    --memory=10g \
    --no-cache \
    -t ${IMAGE_NAME}:${TAG} . \
    --file Containerfile

# Tag as latest if not already
echo "🏷️ Tagging image as ${TAG} and latest..."
podman tag ${IMAGE_NAME}:${TAG} ${IMAGE_NAME}:latest

# Push the image
echo "📤 Pushing image to registry..."
podman push ${IMAGE_NAME}:${TAG}
podman push ${IMAGE_NAME}:latest

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

# Cleanup images
echo "🧹 Cleaning up..."
podman image prune -f

# Stop Podman machine
echo "⏹️ Stopping Podman machine '${PODMAN_MACHINE_NAME}'..."
podman machine stop ${PODMAN_MACHINE_NAME}

# Calculate and display total time
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_TIME / 60))
SECONDS=$((TOTAL_TIME % 60))

echo ""
echo "⏱️  Total deployment time: ${MINUTES}m ${SECONDS}s"
echo "https://vcmuellheim.de"
echo ""