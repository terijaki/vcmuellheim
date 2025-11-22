# AWS CDK Deployment Guide

This project supports separate **dev** and **prod** environments for the SAMS API infrastructure.

## Environment Configuration

### Development (Default)
- **Stack Name:** `SamsApiStack-Dev`
- **Resources:** All resources are prefixed with `dev-` (e.g., `dev-sams-clubs`, `dev-sams-league-matches`)
- **DynamoDB Tables:** Auto-deleted when stack is destroyed (`RemovalPolicy.DESTROY`)
- **Required Env Vars:**
  - `CDK_DEFAULT_ACCOUNT` - Your AWS account ID
  - `SAMS_API_KEY` - SAMS API key
  - `SAMS_SERVER` - SAMS server URL

### Production
- **Stack Name:** `SamsApiStack-Prod`
- **Resources:** All resources are prefixed with `prod-` (e.g., `prod-sams-clubs`, `prod-sams-league-matches`)
- **DynamoDB Tables:** Retained when stack is destroyed (`RemovalPolicy.RETAIN`)
- **Required Env Vars:**
  - `PROD_AWS_ACCOUNT` - Your production AWS account ID (REQUIRED)
  - `SAMS_API_KEY` - SAMS API key
  - `SAMS_SERVER` - SAMS server URL

## Deployment Commands

### Deploy to Development (Default)
```bash
# Deploy dev environment
bun cdk:deploy

# View changes before deploying
bun cdk:diff

# Generate CloudFormation template
bun cdk:synth
```

### Deploy to Production
```bash
# Deploy prod environment
bun cdk:deploy:prod

# View changes before deploying to prod
bun cdk:diff:prod

# Generate CloudFormation template for prod
bun cdk:synth:prod
```

### Other Commands
```bash
# Destroy dev stack
bun cdk:destroy

# Destroy prod stack
bun cdk:destroy:prod

# Bootstrap AWS account (first-time setup)
bun cdk:bootstrap
```

## Setup Instructions

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Fill in your environment variables:**
   ```bash
   # For dev deployment
   CDK_DEFAULT_ACCOUNT=123456789012
   CDK_DEFAULT_REGION=eu-central-1
   SAMS_API_KEY=your-key
   SAMS_SERVER=https://sams-server.example.com

   # For prod deployment (add this line)
   PROD_AWS_ACCOUNT=987654321098
   ```

3. **Bootstrap your AWS account (first-time only):**
   ```bash
   bun cdk:bootstrap
   ```

4. **Deploy:**
   ```bash
   # Deploy to dev
   bun cdk:deploy

   # Deploy to prod
   bun cdk:deploy:prod
   ```

## Resource Naming

All AWS resources are automatically named with the environment prefix:

| Resource Type | Dev Name | Prod Name |
|--------------|----------|-----------|
| DynamoDB Table (clubs) | `dev-sams-clubs` | `prod-sams-clubs` |
| DynamoDB Table (teams) | `dev-sams-teams` | `prod-sams-teams` |
| Lambda Function | `dev-sams-league-matches` | `prod-sams-league-matches` |
| EventBridge Rule | `dev-sams-clubs-weekly-sync` | `prod-sams-clubs-weekly-sync` |
| CloudFront Cache Policy | `dev-sams-api-cache-policy` | `prod-sams-api-cache-policy` |

## Key Differences Between Environments

| Feature | Dev | Prod |
|---------|-----|------|
| DynamoDB Deletion Policy | `DESTROY` (deleted on stack destroy) | `RETAIN` (kept on stack destroy) |
| Stack Name | `SamsApiStack-Dev` | `SamsApiStack-Prod` |
| AWS Account | Uses `CDK_DEFAULT_ACCOUNT` | Uses `PROD_AWS_ACCOUNT` |
| Resource Prefix | `dev-` | `prod-` |

## Outputs

After deployment, you'll see:
- **ApiGatewayUrl:** Direct API Gateway endpoint URL
- **CloudFrontUrl:** CloudFront CDN URL (recommended for production use)
