# AWS Migration Guide

This guide walks through migrating the vcmuellheim.de Next.js application from the current hosting (Coolify/self-hosted) to AWS infrastructure.

## Overview

The migration involves:
1. Deploying AWS infrastructure using CDK
2. Migrating database from current PostgreSQL to Aurora Serverless v2
3. Migrating media files from current storage to S3
4. Configuring AWS Amplify Hosting
5. Testing and validating the deployment
6. DNS cutover

## Prerequisites

### Required Tools
- AWS CLI configured with appropriate credentials
- Node.js 18.x or later
- AWS CDK CLI: `npm install -g aws-cdk`
- PostgreSQL client tools (for database migration)
- AWS account with appropriate permissions

### AWS Permissions Required
Your IAM user/role needs permissions for:
- CloudFormation (full access)
- VPC, EC2, RDS, S3, CloudFront, Amplify, IAM, Secrets Manager
- CDK bootstrap permissions

## Step-by-Step Migration

### Phase 1: Infrastructure Deployment (30-45 minutes)

#### 1.1 Prepare AWS Environment

```bash
# Configure AWS credentials
aws configure

# Set environment variables for CDK
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-central-1

# Verify credentials
aws sts get-caller-identity
```

#### 1.2 Deploy Infrastructure

```bash
# Navigate to infrastructure directory
cd infrastructure

# Install dependencies
npm install

# Build the CDK code
npm run build

# Bootstrap CDK (first time only)
cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}

# Review what will be deployed
npm run synth

# Deploy to development environment
./scripts/deploy.sh dev
```

**Expected Duration**: 30-45 minutes (Aurora cluster creation is slow)

#### 1.3 Retrieve Deployment Outputs

```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --query 'Stacks[?StackName.contains(@, `VCMuellheimDev`)].Outputs' \
  --output table

# Save outputs to file
./scripts/get-db-credentials.sh dev > deployment-outputs.txt
```

**Important**: Store the following securely:
- Database endpoint and credentials
- S3 bucket name and access keys
- CloudFront distribution domain
- Amplify app URL

### Phase 2: Database Migration (15-30 minutes)

#### 2.1 Export Current Database

```bash
# From your current hosting environment
pg_dump -h localhost -U vcmuellheim -d vcmuellheim \
  --no-owner --no-acl \
  --clean --if-exists \
  -f vcmuellheim_export.sql

# Or if using Docker/Podman
podman exec vcmuellheim-db pg_dump -U vcmuellheim vcmuellheim > vcmuellheim_export.sql
```

#### 2.2 Import to Aurora

```bash
# Get database credentials
DATABASE_URL=$(./scripts/get-db-credentials.sh dev | grep "DATABASE_URL:" | cut -d' ' -f2)

# Test connection
psql "$DATABASE_URL" -c "SELECT version();"

# Import database
psql "$DATABASE_URL" < vcmuellheim_export.sql

# Verify import
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

#### 2.3 Run Payload Migrations

```bash
# From the main application directory
DATABASE_URL="$DATABASE_URL" npm run payload migrate
```

### Phase 3: Media Migration (Time varies by data size)

#### 3.1 Export Current Media Files

```bash
# If files are local
tar -czf media_backup.tar.gz media/

# If files are in S3/object storage already
# aws s3 sync s3://old-bucket/ ./media_backup/
```

#### 3.2 Upload to AWS S3

```bash
# Get S3 bucket name from outputs
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name VCMuellheimDevStorageStack \
  --query 'Stacks[0].Outputs[?OutputKey==`MediaBucketName`].OutputValue' \
  --output text)

# Upload media files
aws s3 sync ./media/ s3://${S3_BUCKET}/ --acl private

# Verify upload
aws s3 ls s3://${S3_BUCKET}/ --recursive | wc -l
```

### Phase 4: Configure Amplify Hosting (15-20 minutes)

#### 4.1 Connect GitHub Repository

1. Go to AWS Amplify Console
2. Find your app (vcmuellheim-dev)
3. Click "Connect app"
4. Choose GitHub as source provider
5. Authorize AWS Amplify
6. Select repository: `terijaki/vcmuellheim`
7. Select branch: `develop` (for dev), `main` (for prod)

#### 4.2 Configure Environment Variables

In Amplify Console → App Settings → Environment Variables, add:

```bash
# Database
DATABASE_URL=postgresql://username:password@endpoint:5432/vcmuellheim

# S3 Storage
S3_BUCKET=vcmuellheim-dev-media
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Payload CMS
PAYLOAD_SECRET=<generate-secure-random-string>
PAYLOAD_CONFIG_PATH=./payload.config.ts

# Application
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
TZ=Europe/Berlin
SAMS_SERVER=https://www.volleyball-baden.de

# Optional: Email
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Sentry
SENTRY_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ENVIRONMENT=production

# Development only
PAYLOAD_DEV_EMAIL=admin@example.com
PAYLOAD_DEV_PASSWORD=your-secure-password
```

#### 4.3 Trigger Initial Build

1. In Amplify Console, click "Run build"
2. Monitor build logs for any errors
3. Wait for deployment to complete (10-15 minutes)

#### 4.4 Verify Deployment

```bash
# Get Amplify URL
AMPLIFY_URL=$(aws cloudformation describe-stacks \
  --stack-name VCMuellheimDevHostingStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' \
  --output text)

echo "Application deployed at: $AMPLIFY_URL"

# Test the deployment
curl -I "$AMPLIFY_URL"
```

### Phase 5: Testing & Validation (30-60 minutes)

#### 5.1 Functional Testing

- [ ] Homepage loads correctly
- [ ] Navigation works
- [ ] Database queries return correct data
- [ ] Media/images load from CloudFront
- [ ] Admin panel accessible (/admin)
- [ ] Content creation/editing works
- [ ] Media upload works
- [ ] Email sending works (if configured)

#### 5.2 Performance Testing

```bash
# Test page load time
curl -w "@curl-format.txt" -o /dev/null -s "$AMPLIFY_URL"

# Create curl-format.txt
cat > curl-format.txt <<EOF
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

#### 5.3 Security Testing

- [ ] HTTPS enforced
- [ ] Database not publicly accessible
- [ ] S3 bucket not publicly accessible
- [ ] Proper CORS configuration
- [ ] Environment variables secured
- [ ] Admin panel requires authentication

### Phase 6: Production Deployment (Similar to Dev)

#### 6.1 Deploy Production Infrastructure

```bash
cd infrastructure
./scripts/deploy.sh prod
```

#### 6.2 Migrate Production Database

```bash
# Export from production
pg_dump -h prod-db -U vcmuellheim vcmuellheim > vcmuellheim_prod.sql

# Import to Aurora
DATABASE_URL=$(./scripts/get-db-credentials.sh prod | grep "DATABASE_URL:" | cut -d' ' -f2)
psql "$DATABASE_URL" < vcmuellheim_prod.sql
```

#### 6.3 Configure Production Amplify

- Set production environment variables
- Connect to `main` branch
- Deploy

### Phase 7: DNS Cutover (5-10 minutes + DNS propagation time)

#### 7.1 Configure Custom Domain in Amplify

1. Go to Amplify Console → Domain Management
2. Add domain: `vcmuellheim.de`
3. Add subdomain: `www.vcmuellheim.de`
4. Amplify will provide DNS records

#### 7.2 Update DNS Records

Update your DNS provider (e.g., CloudFlare, Route53):

```
Type: CNAME
Name: vcmuellheim.de
Value: <amplify-domain-provided>
TTL: 300

Type: CNAME
Name: www
Value: <amplify-domain-provided>
TTL: 300
```

#### 7.3 Wait for SSL Certificate

Amplify will automatically provision an SSL certificate via AWS Certificate Manager.
This can take 10-30 minutes.

### Phase 8: Monitoring & Rollback Plan

#### 8.1 Set Up Monitoring

```bash
# CloudWatch dashboard for key metrics
# - Aurora CPU/connections
# - S3 request count
# - Amplify build success rate
# - CloudFront cache hit ratio
```

#### 8.2 Rollback Procedure

If issues occur:

**Quick Rollback (DNS)**:
1. Update DNS back to old hosting
2. Wait for propagation (5-60 minutes)

**Database Rollback**:
1. Take snapshot of Aurora cluster
2. Restore old database
3. Point application back to old DB

**Application Rollback**:
1. In Amplify Console, select previous successful build
2. Click "Redeploy this version"

**Infrastructure Rollback**:
```bash
# Destroy all stacks (WARNING: deletes data)
cd infrastructure
cdk destroy --all --context environment=prod
```

## Cost Estimation

### Development Environment (Monthly)
- Aurora Serverless v2: $25-50
- NAT Gateway: $35
- S3 + CloudFront: $5-20
- Amplify Hosting: $15-30
- **Total**: ~$80-135/month

### Production Environment (Monthly)
- Aurora Serverless v2: $75-200
- NAT Gateway: $35
- S3 + CloudFront: $20-100
- Amplify Hosting: $30-100
- **Total**: ~$160-435/month

## Post-Migration Tasks

- [ ] Monitor costs in AWS Cost Explorer
- [ ] Set up billing alerts
- [ ] Configure automated backups
- [ ] Set up CloudWatch alarms
- [ ] Document new deployment process
- [ ] Update team runbooks
- [ ] Decommission old infrastructure
- [ ] Archive old backups

## Troubleshooting

### Build Fails in Amplify
- Check build logs in Amplify Console
- Verify all environment variables are set
- Ensure dependencies install correctly
- Check Node.js version compatibility

### Database Connection Issues
- Verify security groups allow connections
- Check DATABASE_URL is correct
- Ensure Aurora cluster is "available"
- Test connection from Amplify build container

### Media Upload Fails
- Check S3 credentials
- Verify CORS configuration
- Confirm bucket policy allows uploads
- Check IAM permissions

### Performance Issues
- Check Aurora scaling settings
- Review CloudFront cache settings
- Optimize database queries
- Enable Amplify caching

## Support Resources

- Infrastructure Code: `/infrastructure`
- Deployment Scripts: `/infrastructure/scripts`
- Documentation: `/infrastructure/README.md`
- AWS Documentation: https://docs.aws.amazon.com/
- CDK Documentation: https://docs.aws.amazon.com/cdk/

## Rollback Decision Criteria

Consider rollback if:
- Critical functionality broken for >30 minutes
- Database corruption detected
- Data loss occurred
- Performance degraded >50%
- Security vulnerability exposed
- Cost exceeds budget by >100%

Otherwise, fix forward with hot patches to Amplify.
