# AWS CDK Deployment Guide

This project supports separate **dev** and **prod** environments for the SAMS API infrastructure, with automatic **branch-based isolation** for feature development.

> 🤖 **Automated Deployments:** See [GitHub Actions Setup Guide](.github/GITHUB_ACTIONS_SETUP.md) for automated CI/CD deployment configuration.

## Branch-Based Deployments

When deploying from a **non-main branch**, all resources are automatically namespaced with the branch name. This allows multiple developers to work on different features simultaneously without conflicts.

### How It Works
- **On `main` branch:** Resources use standard names (e.g., `dev-sams-clubs`)
- **On feature branches:** Resources include the branch name (e.g., `dev-aws-migration-sams-clubs`)
- **Branch names are sanitized:** Special characters are replaced with hyphens and truncated to 20 characters

### Example
If you're on branch `feature/new-endpoint`:
- **Stack Name:** `SamsApiStack-Dev-feature-new-endpoi`
- **DynamoDB Table:** `dev-feature-new-endpoi-sams-clubs`
- **Lambda Function:** `dev-feature-new-endpoi-sams-league-matches`
- **Tag:** All resources tagged with `Branch: feature/new-endpoint`

This means you can:
- Deploy multiple feature branches simultaneously
- Test changes in isolation
- Avoid conflicts with main branch or other developers' work

## Environment Configuration

### Development (Default)
- **Stack Name:** 
  - On `main`: `SamsApiStack-Dev`
  - On other branches: `SamsApiStack-Dev-<branch-name>`
- **Resources:** All resources are prefixed with `dev-` (e.g., `dev-sams-clubs`, `dev-sams-league-matches`)
  - On feature branches: `dev-<branch-name>-sams-clubs`, `dev-<branch-name>-sams-league-matches`
- **DynamoDB Tables:** Auto-deleted when stack is destroyed (`RemovalPolicy.DESTROY`)
- **Required Env Vars:**
  - `CDK_ACCOUNT` - AWS account ID
  - `SAMS_API_KEY` - SAMS API key
  - `SAMS_SERVER` - SAMS server URL

### Production
- **Stack Name:** 
  - On `main`: `SamsApiStack-Prod`
  - On other branches: `SamsApiStack-Prod-<branch-name>`
- **Resources:** All resources are prefixed with `prod-` (e.g., `prod-sams-clubs`, `prod-sams-league-matches`)
  - On feature branches: `prod-<branch-name>-sams-clubs`, `prod-<branch-name>-sams-league-matches`
- **DynamoDB Tables:** Retained when stack is destroyed (`RemovalPolicy.RETAIN`)
- **Required Env Vars:**
  - `CDK_ACCOUNT` - AWS account ID
  - `CDK_ENVIRONMENT` - set to `prod` ☝️
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
   CDK_ACCOUNT=123456789012
   CDK_ENVIRONMENT=dev #(optional)
   CDK_REGION=eu-central-1
   SAMS_API_KEY=secret-key
   SAMS_SERVER=https://sams-server.example.com

   # For prod deployment (add this line)
   CDK_ENVIRONMENT=prod
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

All AWS resources are automatically named with the environment prefix and optional branch suffix:

### On Main Branch

| Resource Type | Dev Name | Prod Name |
|--------------|----------|-----------|
| DynamoDB Table (clubs) | `dev-sams-clubs` | `prod-sams-clubs` |
| DynamoDB Table (teams) | `dev-sams-teams` | `prod-sams-teams` |
| Lambda Function | `dev-sams-league-matches` | `prod-sams-league-matches` |
| EventBridge Rule | `dev-sams-clubs-weekly-sync` | `prod-sams-clubs-weekly-sync` |
| CloudFront Cache Policy | `dev-sams-api-cache-policy` | `prod-sams-api-cache-policy` |

### On Feature Branches (e.g., `aws-migration`)

| Resource Type | Dev Name | Prod Name |
|--------------|----------|-----------|
| DynamoDB Table (clubs) | `dev-aws-migration-sams-clubs` | `prod-aws-migration-sams-clubs` |
| DynamoDB Table (teams) | `dev-aws-migration-sams-teams` | `prod-aws-migration-sams-teams` |
| Lambda Function | `dev-aws-migration-sams-league-matches` | `prod-aws-migration-sams-league-matches` |
| EventBridge Rule | `dev-aws-migration-sams-clubs-weekly-sync` | `prod-aws-migration-sams-clubs-weekly-sync` |
| CloudFront Cache Policy | `dev-aws-migration-sams-api-cache-policy` | `prod-aws-migration-sams-api-cache-policy` |

## Key Differences Between Environments

| Feature | Dev | Prod |
|---------|-----|------|
| DynamoDB Deletion Policy | `DESTROY` (deleted on stack destroy) | `RETAIN` (kept on stack destroy) |
| Stack Name (main) | `SamsApiStack-Dev` | `SamsApiStack-Prod` |
| Stack Name (feature branch) | `SamsApiStack-Dev-<branch>` | `SamsApiStack-Prod-<branch>` |
| Resource Prefix (main) | `dev-` | `prod-` |
| Resource Prefix (feature branch) | `dev-<branch>-` | `prod-<branch>-` |
| Branch Tag | Always includes current Git branch | Always includes current Git branch |

## Outputs

After deployment, you'll see:
- **ApiGatewayUrl:** Direct API Gateway endpoint URL
- **CloudFrontUrl:** CloudFront CDN URL (recommended for production use)

## Managing Multiple Deployments

### Listing Deployed Stacks
To see all deployed stacks (including feature branches):
```bash
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `SamsApiStack`)].StackName'
```

### Destroying Feature Branch Stacks
When you're done with a feature branch, destroy its stack to clean up resources:
```bash
# Make sure you're on the feature branch
bun cdk:destroy

# Or specify the stack name explicitly
bun run cdk destroy SamsApiStack-Dev-feature-branch-name
```

### Cost Considerations
- Each feature branch deployment creates a full set of resources (DynamoDB tables, Lambda functions, CloudFront distribution, etc.)
- Remember to destroy feature branch stacks when no longer needed
- EventBridge rules will continue to trigger sync jobs for all deployed branches

> 💡 **Tip:** Use the [GitHub Actions workflows](.github/GITHUB_ACTIONS_SETUP.md) to automatically deploy and destroy stacks based on branch lifecycle.
