#!/bin/bash

set -e

echo "📦 Pushing container image to ECR"

# Get ECR repository URI
ECR_URI=$(aws cloudformation describe-stacks --stack-name VcmuellheimCompute --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' --output text)

if [ "$ECR_URI" = "None" ] || [ -z "$ECR_URI" ]; then
    echo "❌ ECR repository URI not found. Make sure the Compute stack is deployed."
    exit 1
fi

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin $ECR_URI

echo "🏗️ Building container image..."
cd ..  # Go to root directory
docker build -t vcmuellheim:latest -f Containerfile .

echo "🏷️ Tagging image..."
docker tag vcmuellheim:latest $ECR_URI:latest

COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
docker tag vcmuellheim:latest $ECR_URI:$COMMIT_HASH

echo "📤 Pushing images to ECR..."
docker push $ECR_URI:latest
docker push $ECR_URI:$COMMIT_HASH

echo "🔄 Triggering ECS deployment..."
aws ecs update-service \
    --cluster vcmuellheim-cluster \
    --service vcmuellheim-service \
    --force-new-deployment

echo "✅ Container image pushed and deployment triggered!"
echo "🔗 Image: $ECR_URI:$COMMIT_HASH"