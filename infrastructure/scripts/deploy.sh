#!/bin/bash
# AWS Infrastructure Deployment Script
# This script helps deploy the CDK infrastructure with proper checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment is provided
ENVIRONMENT=${1:-dev}

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [dev|staging|prod]"
    exit 1
fi

print_info "Deploying to environment: $ENVIRONMENT"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${CDK_DEFAULT_REGION:-eu-central-1}

print_info "AWS Account: $ACCOUNT_ID"
print_info "AWS Region: $REGION"

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK not found. Install it with: npm install -g aws-cdk"
    exit 1
fi

# Check if we're in the infrastructure directory
if [ ! -f "cdk.json" ]; then
    print_error "cdk.json not found. Are you in the infrastructure directory?"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install
fi

# Build the TypeScript code
print_info "Building CDK code..."
npm run build

# Check if CDK is bootstrapped
print_info "Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "$REGION" > /dev/null 2>&1; then
    print_warning "CDK not bootstrapped in this account/region. Bootstrapping now..."
    cdk bootstrap "aws://${ACCOUNT_ID}/${REGION}"
fi

# Show diff before deployment (if not first deployment)
print_info "Checking for infrastructure changes..."
if cdk diff --context environment="$ENVIRONMENT" 2>&1 | grep -q "Stack"; then
    cdk diff --context environment="$ENVIRONMENT"
    
    echo ""
    read -p "Do you want to proceed with deployment? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        print_info "Deployment cancelled."
        exit 0
    fi
fi

# Deploy all stacks
print_info "Deploying all stacks to $ENVIRONMENT environment..."
cdk deploy --all \
    --context environment="$ENVIRONMENT" \
    --require-approval never \
    --outputs-file "outputs-${ENVIRONMENT}.json"

print_info "Deployment completed successfully!"
print_info "Stack outputs saved to: outputs-${ENVIRONMENT}.json"

# Extract important information from outputs
if [ -f "outputs-${ENVIRONMENT}.json" ]; then
    print_info "Extracting deployment information..."
    
    # Parse outputs using jq if available
    if command -v jq &> /dev/null; then
        echo ""
        print_info "Important values:"
        echo ""
        
        # Database endpoint
        DB_ENDPOINT=$(jq -r '.[].ClusterEndpoint // empty' "outputs-${ENVIRONMENT}.json" 2>/dev/null)
        if [ -n "$DB_ENDPOINT" ]; then
            echo "  Database Endpoint: $DB_ENDPOINT"
        fi
        
        # S3 bucket name
        S3_BUCKET=$(jq -r '.[].MediaBucketName // empty' "outputs-${ENVIRONMENT}.json" 2>/dev/null)
        if [ -n "$S3_BUCKET" ]; then
            echo "  S3 Bucket: $S3_BUCKET"
        fi
        
        # CloudFront domain
        CF_DOMAIN=$(jq -r '.[].CloudFrontDomainName // empty' "outputs-${ENVIRONMENT}.json" 2>/dev/null)
        if [ -n "$CF_DOMAIN" ]; then
            echo "  CloudFront Domain: $CF_DOMAIN"
        fi
        
        # Amplify URL
        AMPLIFY_URL=$(jq -r '.[].AmplifyAppUrl // empty' "outputs-${ENVIRONMENT}.json" 2>/dev/null)
        if [ -n "$AMPLIFY_URL" ]; then
            echo "  Amplify App URL: $AMPLIFY_URL"
        fi
        
        echo ""
    fi
fi

print_info "Next steps:"
echo "  1. Configure GitHub connection in AWS Amplify Console"
echo "  2. Set environment variables in Amplify (see AWS_DEPLOYMENT.md)"
echo "  3. Retrieve database credentials from Secrets Manager"
echo "  4. Set DATABASE_URL in Amplify environment variables"
echo "  5. Trigger initial build in Amplify"

print_warning "Don't forget to store the S3 secret access key securely!"
print_warning "It's only shown once in CloudFormation outputs."
