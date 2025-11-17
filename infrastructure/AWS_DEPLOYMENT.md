# AWS Deployment Configuration

This file documents the environment variables needed for AWS deployment.

## Environment Variables for AWS Amplify

Add these environment variables in the AWS Amplify Console under:
**App Settings → Environment variables**

### Required Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@cluster-endpoint.region.rds.amazonaws.com:5432/vcmuellheim
# OR use Secrets Manager (recommended)
DATABASE_SECRET_ARN=arn:aws:secretsmanager:region:account:secret:vcmuellheim-env-db-credentials
DATABASE_ENDPOINT=cluster-endpoint.region.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=vcmuellheim

# S3 Storage (automatically set by CDK, but can be overridden)
S3_BUCKET=vcmuellheim-env-media
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Payload CMS
PAYLOAD_SECRET=<generate-a-secure-random-string-32-chars>
PAYLOAD_CONFIG_PATH=./payload.config.ts

# Application
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
TZ=Europe/Berlin
```

### Optional Variables

```bash
# Email (if using Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Sentry (for error tracking)
SENTRY_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ENVIRONMENT=production

# Development Auto-login (dev environment only)
PAYLOAD_DEV_EMAIL=admin@example.com
PAYLOAD_DEV_PASSWORD=your-secure-password

# SAMS Integration
SAMS_SERVER=https://www.volleyball-baden.de

# Custom Image Loader (if using Coolify or custom CDN)
COOLIFY_URL=https://your-custom-cdn.example.com
```

## How to Get Database Credentials

### Option 1: AWS Console

1. Go to AWS Secrets Manager Console
2. Find secret: `vcmuellheim-{environment}-db-credentials`
3. Click "Retrieve secret value"
4. Copy the username and password
5. Get cluster endpoint from RDS Console
6. Construct DATABASE_URL: `postgresql://{username}:{password}@{endpoint}:5432/vcmuellheim`

### Option 2: AWS CLI

```bash
# Get the secret ARN from CDK outputs
aws cloudformation describe-stacks \
  --stack-name VCMuellheimDevDatabaseStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SecretArn`].OutputValue' \
  --output text

# Retrieve the secret value
aws secretsmanager get-secret-value \
  --secret-id <SECRET_ARN> \
  --query SecretString \
  --output text

# Get the cluster endpoint
aws cloudformation describe-stacks \
  --stack-name VCMuellheimDevDatabaseStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text
```

### Option 3: Using the utility script

```bash
# From infrastructure directory
cd infrastructure

# Get database credentials
node -e "
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

async function getCredentials() {
  const client = new SecretsManagerClient({ region: 'eu-central-1' });
  const response = await client.send(
    new GetSecretValueCommand({ 
      SecretId: 'vcmuellheim-dev-db-credentials' 
    })
  );
  console.log(JSON.parse(response.SecretString));
}

getCredentials();
"
```

## How to Get S3 Credentials

S3 access credentials are automatically created by the CDK stack. Retrieve them:

```bash
# Get access key ID (from CloudFormation outputs)
aws cloudformation describe-stacks \
  --stack-name VCMuellheimDevStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaUploadAccessKeyId`].OutputValue' \
  --output text

# Get secret access key (only shown once during stack creation)
# Check the CloudFormation outputs immediately after deployment
# OR create a new access key via IAM Console for user: vcmuellheim-{env}-media-upload
```

**Note**: The secret access key is only shown once during stack creation. Store it securely or create a new access key if needed.

## Generating PAYLOAD_SECRET

Generate a secure random string for PAYLOAD_SECRET:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using /dev/urandom (Linux/Mac)
head -c 32 /dev/urandom | base64
```

## Environment-Specific Configuration

### Development
- Use `dev` subdomain: `dev.vcmuellheim.de`
- Amplify branch: `develop`
- Auto-login enabled (set PAYLOAD_DEV_EMAIL and PAYLOAD_DEV_PASSWORD)

### Staging
- Use `staging` subdomain: `staging.vcmuellheim.de`
- Amplify branch: `staging`
- Production-like configuration

### Production
- Use main domain: `vcmuellheim.de`
- Amplify branch: `main`
- Enhanced security and monitoring

## Setting Up Amplify GitHub Connection

1. Go to AWS Amplify Console
2. Select your app
3. Click "Connect app"
4. Choose GitHub as the source
5. Authorize AWS Amplify to access your GitHub account
6. Select the repository: `terijaki/vcmuellheim`
7. Select the branch based on environment:
   - Dev: `develop`
   - Staging: `staging`
   - Prod: `main`

Alternatively, create a GitHub Personal Access Token:
1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `admin:repo_hook`
4. Copy the token
5. Add it to Amplify app settings

## Testing Database Connection

Before deploying, test the database connection:

```bash
# Install PostgreSQL client
# On Ubuntu/Debian:
sudo apt-get install postgresql-client

# On macOS:
brew install postgresql

# Test connection
psql "postgresql://{username}:{password}@{endpoint}:5432/vcmuellheim"

# List tables (after Payload migrations run)
\dt

# Exit
\q
```

## Monitoring and Logs

### CloudWatch Logs
- Aurora logs: `/aws/rds/cluster/{cluster-name}/postgresql`
- Amplify build logs: Available in Amplify Console
- Application logs: Configured in Amplify Console

### Metrics to Monitor
- Database CPU utilization
- Database connections
- S3 request count
- CloudFront cache hit ratio
- Amplify build duration

## Troubleshooting

### Database Connection Timeout
- Check security group allows inbound on port 5432
- Verify VPC configuration
- Ensure database cluster is in "available" state

### S3 Upload Fails
- Verify IAM permissions
- Check CORS configuration
- Confirm bucket name and region

### Amplify Build Fails
- Review build logs in Amplify Console
- Verify all environment variables are set
- Check Node.js version compatibility
- Ensure dependencies install correctly

### Environment Variables Not Loading
- Verify variables are set in Amplify Console
- Check variable names (case-sensitive)
- Restart build after adding variables
