#!/bin/bash
# Script to retrieve database credentials from AWS Secrets Manager

set -e

ENVIRONMENT=${1:-dev}
REGION=${CDK_DEFAULT_REGION:-eu-central-1}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info "Retrieving database credentials for environment: $ENVIRONMENT"

# Get the secret ARN from CloudFormation
SECRET_ARN=$(aws cloudformation describe-stacks \
    --stack-name "VCMuellheim${ENVIRONMENT^}DatabaseStack" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`SecretArn`].OutputValue' \
    --output text 2>/dev/null)

if [ -z "$SECRET_ARN" ]; then
    print_warning "Could not find secret ARN. Make sure the stack is deployed."
    exit 1
fi

print_info "Secret ARN: $SECRET_ARN"

# Retrieve the secret value
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ARN" \
    --region "$REGION" \
    --query SecretString \
    --output text)

# Get the database endpoint
DB_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "VCMuellheim${ENVIRONMENT^}DatabaseStack" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
    --output text 2>/dev/null)

# Get the database port
DB_PORT=$(aws cloudformation describe-stacks \
    --stack-name "VCMuellheim${ENVIRONMENT^}DatabaseStack" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ClusterPort`].OutputValue' \
    --output text 2>/dev/null)

# Get the database name
DB_NAME=$(aws cloudformation describe-stacks \
    --stack-name "VCMuellheim${ENVIRONMENT^}DatabaseStack" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`DatabaseName`].OutputValue' \
    --output text 2>/dev/null)

# Parse credentials if jq is available
if command -v jq &> /dev/null; then
    USERNAME=$(echo "$SECRET_VALUE" | jq -r '.username')
    PASSWORD=$(echo "$SECRET_VALUE" | jq -r '.password')
    
    echo ""
    print_info "Database Credentials:"
    echo "  Username: $USERNAME"
    echo "  Password: $PASSWORD"
    echo ""
    print_info "Connection Details:"
    echo "  Endpoint: $DB_ENDPOINT"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo ""
    print_info "DATABASE_URL:"
    echo "  postgresql://${USERNAME}:${PASSWORD}@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}"
    echo ""
else
    echo ""
    print_info "Raw secret value (install jq for formatted output):"
    echo "$SECRET_VALUE"
    echo ""
    print_info "Connection Details:"
    echo "  Endpoint: $DB_ENDPOINT"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
fi

print_info "Set this in Amplify environment variables as DATABASE_URL"
