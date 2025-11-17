# VCMuellheim AWS Infrastructure

This directory contains the AWS CDK infrastructure code for deploying the vcmuellheim.de Next.js application with Payload CMS to AWS.

## Architecture Overview

The infrastructure consists of the following components:

### 1. **Network Stack**
- VPC with public and private subnets across 2 Availability Zones
- NAT Gateway for private subnet internet access
- Security groups for application and database layers
- Isolated database subnets

### 2. **Database Stack**
- Aurora Serverless v2 with PostgreSQL compatibility
- Automatic scaling based on workload
- Automated backups with configurable retention
- AWS Secrets Manager for credential management
- Encryption at rest and in transit

### 3. **Storage Stack**
- S3 bucket for media uploads (Payload CMS)
- CloudFront CDN for global content delivery
- IAM user and access keys for S3 uploads
- CORS configuration for web access

### 4. **Hosting Stack**
- AWS Amplify Hosting for Next.js application
- Automatic builds on git push
- Environment variable management
- SSL/TLS certificates
- Global CDN delivery

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account**: Active AWS account with appropriate permissions
2. **AWS CLI**: Installed and configured
   ```bash
   aws configure
   ```
3. **Node.js**: Version 18.x or later
4. **AWS CDK**: Installed globally
   ```bash
   npm install -g aws-cdk
   ```
5. **GitHub Token**: Personal access token for Amplify to access the repository

## Environment Configuration

The infrastructure supports three environments:
- `dev` - Development environment
- `staging` - Staging environment
- `prod` - Production environment

Configuration is managed in `config/environment.ts`. Key differences:

| Feature | Dev | Staging | Prod |
|---------|-----|---------|------|
| Aurora Min Capacity | 0.5 ACU | 0.5 ACU | 1 ACU |
| Aurora Max Capacity | 2 ACU | 2 ACU | 4 ACU |
| Backup Retention | 7 days | 7 days | 30 days |
| Deletion Protection | No | No | Yes |
| Reader Instance | No | No | Yes |
| S3 Versioning | No | No | Yes |

## Installation

1. Install dependencies:
   ```bash
   cd infrastructure
   npm install
   ```

2. Build the TypeScript code:
   ```bash
   npm run build
   ```

3. Bootstrap CDK (first time only):
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

## Deployment

### First-Time Deployment

1. **Set AWS credentials**:
   ```bash
   export CDK_DEFAULT_ACCOUNT=123456789012
   export CDK_DEFAULT_REGION=eu-central-1
   ```

2. **Deploy all stacks** (development):
   ```bash
   npm run deploy:dev
   ```

3. **Configure GitHub connection**:
   - Go to AWS Amplify Console
   - Select the created app
   - Connect to GitHub repository
   - Set up OAuth token or GitHub App

4. **Set sensitive environment variables** in Amplify Console:
   - `PAYLOAD_SECRET` - Secret key for Payload CMS
   - `RESEND_API_KEY` - API key for email service (if used)
   - `SENTRY_AUTH_TOKEN` - Sentry authentication token (if used)
   - `PAYLOAD_DEV_EMAIL` - Development login email (dev only)
   - `PAYLOAD_DEV_PASSWORD` - Development login password (dev only)

5. **Update DATABASE_URL**:
   The database connection string is stored in AWS Secrets Manager. Create a custom Lambda function or update the Amplify build to retrieve and set the `DATABASE_URL` environment variable:
   ```
   postgresql://username:password@cluster-endpoint:5432/vcmuellheim
   ```

### Subsequent Deployments

Deploy to specific environment:
```bash
npm run deploy:dev      # Development
npm run deploy:staging  # Staging
npm run deploy:prod     # Production
```

Or deploy all stacks:
```bash
npm run deploy
```

### View Changes Before Deployment

```bash
npm run diff
```

### Synthesize CloudFormation Templates

```bash
npm run synth
```

## Environment Variables

The following environment variables are automatically configured:

### Amplify Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `NODE_ENV` | Node environment | Static: `production` |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | Static: `1` |
| `DATABASE_SECRET_ARN` | ARN of database credentials secret | From Database Stack |
| `S3_BUCKET` | S3 bucket name for media | From Storage Stack |
| `S3_REGION` | S3 bucket region | From config |
| `S3_ACCESS_KEY_ID` | S3 access key ID | From Storage Stack |
| `S3_SECRET_ACCESS_KEY` | S3 secret access key | From Storage Stack |
| `SAMS_SERVER` | SAMS server URL | Static |

### Required Manual Configuration

Set these in Amplify Console under App Settings > Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `PAYLOAD_SECRET` | Payload CMS secret key | Yes |
| `DATABASE_URL` | Full PostgreSQL connection string | Yes |
| `RESEND_API_KEY` | Resend email API key | Optional |
| `SENTRY_AUTH_TOKEN` | Sentry auth token | Optional |
| `COOLIFY_URL` | Custom image loader URL | Optional |

## Retrieving Database Credentials

Database credentials are stored in AWS Secrets Manager. To retrieve them:

```bash
# Get secret ARN from stack outputs
aws cloudformation describe-stacks \
  --stack-name VCMuellheimDevDatabaseStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SecretArn`].OutputValue' \
  --output text

# Retrieve secret value
aws secretsmanager get-secret-value \
  --secret-id <SECRET_ARN> \
  --query SecretString \
  --output text | jq -r '.password'
```

## Stack Outputs

After deployment, important values are exported as CloudFormation outputs:

### Network Stack
- `VpcId` - VPC identifier
- `DatabaseSecurityGroupId` - Database security group ID
- `ApplicationSecurityGroupId` - Application security group ID

### Database Stack
- `ClusterEndpoint` - Aurora cluster endpoint hostname
- `ClusterPort` - Aurora cluster port (5432)
- `SecretArn` - Database credentials secret ARN
- `DatabaseName` - Database name (vcmuellheim)

### Storage Stack
- `MediaBucketName` - S3 bucket name
- `CloudFrontDistributionId` - CloudFront distribution ID
- `CloudFrontDomainName` - CloudFront domain name
- `MediaUploadAccessKeyId` - S3 access key ID

### Hosting Stack
- `AmplifyAppId` - Amplify application ID
- `AmplifyDefaultDomain` - Amplify default domain
- `AmplifyAppUrl` - Full application URL

## Application Configuration Updates

### Database Connection

Update the application's database configuration to use AWS Secrets Manager:

1. Install AWS SDK:
   ```bash
   npm install @aws-sdk/client-secrets-manager
   ```

2. Create a helper function to retrieve database URL:
   ```typescript
   import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

   async function getDatabaseUrl() {
     if (process.env.DATABASE_URL) {
       return process.env.DATABASE_URL;
     }

     const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
     const response = await client.send(
       new GetSecretValueCommand({ SecretId: process.env.DATABASE_SECRET_ARN })
     );
     
     const secret = JSON.parse(response.SecretString!);
     const endpoint = process.env.DATABASE_ENDPOINT;
     
     return `postgresql://${secret.username}:${secret.password}@${endpoint}/vcmuellheim`;
   }
   ```

### S3 Configuration

The S3 configuration in `payload.config.ts` is already compatible. Ensure environment variables are set:
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

## Destroying Infrastructure

⚠️ **WARNING**: This will delete all resources including databases and S3 buckets!

```bash
# Development
cdk destroy --all --context environment=dev

# Staging
cdk destroy --all --context environment=staging

# Production (deletion protection must be disabled first)
cdk destroy --all --context environment=prod
```

For production, you must first:
1. Disable deletion protection on the Aurora cluster
2. Update the RemovalPolicy to DESTROY
3. Redeploy, then destroy

## Rollback Procedures

### Application Rollback

1. **Amplify Console Rollback**:
   - Go to AWS Amplify Console
   - Select the app and branch
   - Choose a previous successful build
   - Click "Redeploy this version"

2. **Git Rollback**:
   ```bash
   git revert <commit-hash>
   git push origin <branch>
   ```
   Amplify will automatically deploy the reverted version.

### Infrastructure Rollback

1. **Identify the change**:
   ```bash
   aws cloudformation describe-stack-events \
     --stack-name <STACK_NAME> \
     --max-items 50
   ```

2. **Rollback via CloudFormation**:
   ```bash
   aws cloudformation continue-update-rollback \
     --stack-name <STACK_NAME>
   ```

3. **Rollback via CDK** (deploy previous version):
   ```bash
   git checkout <previous-commit>
   npm run deploy
   ```

### Database Rollback

1. **Point-in-time recovery**:
   ```bash
   aws rds restore-db-cluster-to-point-in-time \
     --source-db-cluster-identifier <cluster-id> \
     --db-cluster-identifier <new-cluster-id> \
     --restore-to-time <timestamp>
   ```

2. **Restore from snapshot**:
   ```bash
   aws rds restore-db-cluster-from-snapshot \
     --db-cluster-identifier <new-cluster-id> \
     --snapshot-identifier <snapshot-id>
   ```

## Cost Optimization

### Development Environment
- Aurora Serverless v2 scales to 0.5 ACU when idle
- Single NAT Gateway
- No reader instances
- 7-day backup retention

### Production Environment
- Aurora Serverless v2 with 1-4 ACU range
- Reader instance for high availability
- 30-day backup retention
- S3 versioning for data protection

### Estimated Monthly Costs (USD)

| Component | Dev | Prod |
|-----------|-----|------|
| Aurora Serverless v2 | $25-50 | $75-200 |
| NAT Gateway | $35 | $35 |
| S3 + CloudFront | $5-20 | $20-100 |
| Amplify Hosting | $15-30 | $30-100 |
| **Total** | **$80-135** | **$160-435** |

*Note: Costs vary based on traffic and data storage*

## Security Best Practices

1. **Secrets Management**:
   - Never commit secrets to git
   - Use AWS Secrets Manager for database credentials
   - Rotate credentials regularly

2. **Network Security**:
   - Database in isolated subnets
   - Security groups with least privilege
   - VPC endpoints for AWS services (optional enhancement)

3. **IAM Permissions**:
   - Principle of least privilege
   - Separate IAM users for different purposes
   - Enable MFA for AWS Console access

4. **Monitoring**:
   - Enable CloudWatch logs
   - Set up CloudWatch alarms for critical metrics
   - Monitor CloudTrail for security events

## Troubleshooting

### CDK Deployment Fails

1. Check AWS credentials:
   ```bash
   aws sts get-caller-identity
   ```

2. Verify CDK bootstrap:
   ```bash
   cdk bootstrap
   ```

3. Check CloudFormation events:
   ```bash
   aws cloudformation describe-stack-events \
     --stack-name <STACK_NAME>
   ```

### Amplify Build Fails

1. Check build logs in Amplify Console
2. Verify environment variables are set correctly
3. Ensure GitHub repository connection is active
4. Check IAM role permissions

### Database Connection Issues

1. Verify security group rules allow access
2. Check database endpoint and port
3. Verify credentials in Secrets Manager
4. Ensure database is in available state

## Support

For issues or questions:
- GitHub Issues: https://github.com/terijaki/vcmuellheim/issues
- AWS Support: https://console.aws.amazon.com/support/

## License

This infrastructure code is part of the vcmuellheim project.
