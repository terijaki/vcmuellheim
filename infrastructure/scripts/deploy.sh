#!/bin/bash

set -e

echo "🚀 Deploying VCM Müllheim AWS Infrastructure"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "eu-central-1")

echo "📊 Deploying to account: $AWS_ACCOUNT in region: $AWS_REGION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Bootstrap CDK if needed
echo "🥾 Bootstrapping CDK..."
cdk bootstrap aws://$AWS_ACCOUNT/$AWS_REGION

# Deploy stacks in order
echo "🏗️ Deploying infrastructure stacks..."

echo "1️⃣ Deploying Networking Stack..."
cdk deploy VcmuellheimNetworking --require-approval never

echo "2️⃣ Deploying Database Stack..."
cdk deploy VcmuellheimDatabase --require-approval never

echo "3️⃣ Deploying Domain Stack..."
cdk deploy VcmuellheimDomain --require-approval never

echo "4️⃣ Deploying Compute Stack..."
cdk deploy VcmuellheimCompute --require-approval never

echo "5️⃣ Deploying CI/CD Stack..."
cdk deploy VcmuellheimCicd --require-approval never

echo "6️⃣ Deploying Monitoring Stack..."
cdk deploy VcmuellheimMonitoring --require-approval never

echo "✅ All stacks deployed successfully!"

# Get outputs
echo "📋 Stack Outputs:"
echo "=================="

ECR_URI=$(aws cloudformation describe-stacks --stack-name VcmuellheimCompute --query 'Stacks[0].Outputs[?OutputKey==`EcrRepositoryUri`].OutputValue' --output text 2>/dev/null || echo "Not available")
ALB_DNS=$(aws cloudformation describe-stacks --stack-name VcmuellheimCompute --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDnsName`].OutputValue' --output text 2>/dev/null || echo "Not available")
CLOUDFRONT_DNS=$(aws cloudformation describe-stacks --stack-name VcmuellheimCompute --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' --output text 2>/dev/null || echo "Not available")
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name VcmuellheimDatabase --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' --output text 2>/dev/null || echo "Not available")
GITHUB_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name VcmuellheimCicd --query 'Stacks[0].Outputs[?OutputKey==`GitHubSecretArn`].OutputValue' --output text 2>/dev/null || echo "Not available")
APP_SECRETS_ARN=$(aws cloudformation describe-stacks --stack-name VcmuellheimDatabase --query 'Stacks[0].Outputs[?OutputKey==`AppSecretsArn`].OutputValue' --output text 2>/dev/null || echo "Not available")

echo "ECR Repository URI: $ECR_URI"
echo "Load Balancer DNS: $ALB_DNS"
echo "CloudFront DNS: $CLOUDFRONT_DNS"
echo "Database Endpoint: $DB_ENDPOINT"
echo "GitHub Secret ARN: $GITHUB_SECRET_ARN"
echo "App Secrets ARN: $APP_SECRETS_ARN"

echo ""
echo "🔧 Next Steps:"
echo "=============="
echo "1. Update GitHub token:"
echo "   aws secretsmanager update-secret --secret-id \"$GITHUB_SECRET_ARN\" --secret-string \"your-github-token\""
echo ""
echo "2. Update application secrets:"
echo "   aws secretsmanager update-secret --secret-id \"$APP_SECRETS_ARN\" --secret-string '{
    \"PAYLOAD_SECRET\": \"your-payload-secret\",
    \"RESEND_API_KEY\": \"your-resend-api-key\",
    \"S3_ACCESS_KEY_ID\": \"your-s3-access-key\",
    \"S3_SECRET_ACCESS_KEY\": \"your-s3-secret-key\"
  }'"
echo ""
echo "3. Push initial container image:"
echo "   ./scripts/push-image.sh"
echo ""
echo "4. Configure monitoring email:"
echo "   aws sns subscribe --topic-arn \$(aws cloudformation describe-stacks --stack-name VcmuellheimMonitoring --query 'Stacks[0].Outputs[?OutputKey==\`AlarmTopicArn\`].OutputValue' --output text) --protocol email --notification-endpoint admin@vcmuellheim.de"
echo ""
echo "🎉 Infrastructure deployment complete!"