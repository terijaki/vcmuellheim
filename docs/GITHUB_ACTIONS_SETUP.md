# GitHub Actions Setup for AWS CDK Deployments

This guide explains how to set up automated AWS CDK deployments using GitHub Actions.

## Workflows Overview

### 1. `cdk-deploy.yml` - Automatic Deployment
- **Triggers on:** Push to any branch
- **Main branch:** Deploys to production environment
- **Feature branches:** Deploys to dev environment with branch-specific resources
- **Auto-comments:** Adds deployment info to commits on feature branches

### 2. `cdk-destroy.yml` - Automatic Cleanup
- **Triggers on:** PR closed or branch deleted
- **Purpose:** Automatically destroys CDK stacks for feature branches
- **Safety:** Only destroys dev stacks, never production

## Required Secrets

Configure the following secrets in your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Example |
|------------|-------------|---------|
| `AWS_ROLE_ARN` | AWS IAM Role ARN for OIDC authentication | `arn:aws:iam::123456789012:role/GitHubActionsCDKRole` |
| `AWS_ACCOUNT_ID` | Your AWS Account ID | `123456789012` |
| `AWS_REGION` | AWS Region for deployment (optional) | `eu-central-1` |
| `SAMS_API_KEY` | SAMS API key | `your-secret-api-key` |
| `SAMS_SERVER` | SAMS server URL | `https://sams-server.example.com` |

## AWS IAM Setup

### Step 1: Create OIDC Provider

Create an OIDC identity provider in AWS IAM:

```bash
# In AWS Console: IAM → Identity providers → Add provider
# Provider type: OpenID Connect
# Provider URL: https://token.actions.githubusercontent.com
# Audience: sts.amazonaws.com
```

Or via AWS CLI:
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### Step 2: Create IAM Role

Create an IAM role with the following trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
        }
      }
    }
  ]
}
```

Replace:
- `YOUR_ACCOUNT_ID` with your AWS account ID
- `YOUR_ORG/YOUR_REPO` with your GitHub organization and repository (e.g., `terijaki/vcmuellheim`)

### Step 3: Attach Permissions

Attach these AWS managed policies to the role:
- `AWSCloudFormationFullAccess`
- `IAMFullAccess` (for CDK to create service roles)
- `AmazonS3FullAccess` (for CDK assets)
- `AWSLambda_FullAccess`
- `AmazonDynamoDBFullAccess`
- `CloudFrontFullAccess`
- `AmazonAPIGatewayAdministrator`
- `AmazonEventBridgeFullAccess`

Or create a custom policy with minimum required permissions for your stack.

### Step 4: Bootstrap CDK (One-time)

Bootstrap your AWS account for CDK (if not already done):

```bash
# Set your AWS credentials locally
export AWS_PROFILE=your-profile

# Bootstrap CDK
bun run cdk bootstrap aws://YOUR_ACCOUNT_ID/eu-central-1
```

## Workflow Behavior

### Feature Branch Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/new-endpoint
   ```

2. **Make changes and push:**
   ```bash
   git add .
   git commit -m "Add new endpoint"
   git push origin feature/new-endpoint
   ```

3. **GitHub Actions automatically:**
   - Detects it's not the main branch
   - Deploys to dev environment
   - Creates stack: `SamsApiStack-Dev-feature-new-endpoi`
   - Comments on commit with stack info

4. **When PR is merged or branch deleted:**
   - GitHub Actions automatically destroys the stack
   - Cleans up all AWS resources
   - Comments on PR confirming cleanup

### Main Branch Workflow

1. **Merge to main:**
   ```bash
   git checkout main
   git merge feature/new-endpoint
   git push origin main
   ```

2. **GitHub Actions automatically:**
   - Detects it's the main branch
   - Deploys to production environment
   - Creates/updates stack: `SamsApiStack-Prod`
   - Production stack is never auto-deleted

## Manual Stack Management

### List all deployed stacks
```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `SamsApiStack`)].StackName'
```

### Manually destroy a feature branch stack
```bash
# From the feature branch
git checkout feature/branch-name
bun run cdk destroy

# Or specify stack name explicitly
bun run cdk destroy SamsApiStack-Dev-feature-branch-name
```

### Manually deploy without GitHub Actions
```bash
# Dev deployment (from any branch)
bun run cdk deploy

# Prod deployment (requires CDK_ENVIRONMENT=prod)
bun run cdk:deploy:prod
```

## Workflow Triggers

### `cdk-deploy.yml` triggers on:
- Push to any branch
- Only when these files change:
  - `lib/**`
  - `lambda/**`
  - `bin/cdk.ts`
  - `cdk.json`
  - `package.json`
  - `.github/workflows/cdk-deploy.yml`

### `cdk-destroy.yml` triggers on:
- Pull request closed (merged or not)
- Branch deleted
- Only for non-main branches

## Customization

### Change deployment paths
Edit the `paths` section in `cdk-deploy.yml`:
```yaml
paths:
  - 'lib/**'
  - 'lambda/**'
  - 'your-custom-path/**'
```

### Add notifications
Add Slack/Discord notifications by adding a step after deployment:
```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "CDK deployment completed for ${{ github.ref }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Skip deployment for certain branches
Add branch exclusions:
```yaml
on:
  push:
    branches:
      - main
      - '**'
    branches-ignore:
      - 'docs/**'
      - 'test/**'
```

## Troubleshooting

### Deployment fails with "Access Denied"
- Check IAM role permissions
- Verify OIDC provider is configured correctly
- Ensure `AWS_ROLE_ARN` secret is correct

### Stack already exists error
- Another branch with similar name may have created it
- Check AWS CloudFormation console
- Manually destroy conflicting stack

### Destroy workflow doesn't run
- Ensure PR is actually closed (not just created)
- Check workflow logs in Actions tab
- Verify stack name matches expected pattern

### Missing secrets error
- Go to Settings → Secrets and variables → Actions
- Verify all required secrets are configured
- Check secret names match exactly

## Cost Management

**Important:** Each feature branch creates a full stack of AWS resources.

### Best Practices:
1. ✅ Delete branches when done
2. ✅ Close/merge PRs promptly
3. ✅ Monitor AWS costs regularly
4. ✅ Set up AWS budget alerts

### Check for orphaned stacks:
```bash
# List all SamsApiStack stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `SamsApiStack`)].{Name:StackName,Created:CreationTime}' \
  --output table
```

### Manually clean up old stacks:
```bash
aws cloudformation delete-stack --stack-name SamsApiStack-Dev-old-branch-name
```
