# VCM Müllheim AWS Infrastructure

This directory contains AWS CDK infrastructure code for migrating the VCM Müllheim website from Hetzner VPS to AWS.

## Architecture Overview

The infrastructure consists of multiple CDK stacks that work together to provide a scalable, secure, and cost-effective hosting solution:

### Stacks

1. **NetworkingStack** - VPC, subnets, security groups, and VPC endpoints
2. **DatabaseStack** - RDS PostgreSQL database with secrets management
3. **DomainStack** - Route 53 hosted zone and SSL certificates
4. **ComputeStack** - ECS Fargate, Application Load Balancer, CloudFront, and S3
5. **CicdStack** - CodePipeline, CodeBuild, and ECR for automated deployments
6. **MonitoringStack** - CloudWatch dashboards, alarms, and SNS notifications

### AWS Services Used

- **Compute**: ECS Fargate for container hosting
- **Database**: RDS PostgreSQL with automated backups
- **Container Registry**: ECR for Docker images
- **CI/CD**: CodePipeline + CodeBuild for automated deployments
- **Load Balancing**: Application Load Balancer with SSL termination
- **CDN**: CloudFront for global content delivery
- **DNS**: Route 53 for domain management
- **Storage**: S3 for file uploads and static assets
- **Secrets**: AWS Secrets Manager for sensitive configuration
- **Monitoring**: CloudWatch for metrics, logs, and alarms
- **Networking**: VPC with public/private subnets across multiple AZs

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **AWS CDK** installed (`npm install -g aws-cdk`)
3. **Node.js** (version 18 or later)
4. **Domain**: Existing Route 53 hosted zone for `vcmuellheim.de`

## Deployment

### 1. Install Dependencies

```bash
cd infrastructure
npm install
```

### 2. Bootstrap CDK (first time only)

```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### 3. Deploy Infrastructure

Deploy all stacks in the correct order:

```bash
# Deploy all stacks
npm run deploy

# Or deploy individual stacks in order
cdk deploy VcmuellheimNetworking
cdk deploy VcmuellheimDatabase
cdk deploy VcmuellheimDomain
cdk deploy VcmuellheimCompute
cdk deploy VcmuellheimCicd
cdk deploy VcmuellheimMonitoring
```

### 4. Post-Deployment Configuration

After deployment, you'll need to configure some values manually:

#### GitHub Token for CI/CD
```bash
# Get the GitHub secret ARN from outputs
aws secretsmanager update-secret \
  --secret-id "arn:aws:secretsmanager:..." \
  --secret-string "your-github-personal-access-token"
```

#### Application Secrets
```bash
# Update application secrets
aws secretsmanager update-secret \
  --secret-id "arn:aws:secretsmanager:..." \
  --secret-string '{
    "PAYLOAD_SECRET": "your-payload-secret",
    "RESEND_API_KEY": "your-resend-api-key",
    "S3_BUCKET": "vcmuellheim-assets-ACCOUNT",
    "S3_REGION": "eu-central-1",
    "S3_ACCESS_KEY_ID": "your-s3-access-key",
    "S3_SECRET_ACCESS_KEY": "your-s3-secret-key",
    "SAMS_SERVER": "https://www.volleyball-baden.de",
    "NODE_ENV": "production",
    "SENTRY_ENVIRONMENT": "production",
    "TZ": "Europe/Berlin",
    "NEXT_TELEMETRY_DISABLED": "1"
  }'
```

#### Email Notifications
```bash
# Subscribe to SNS topic for alarms
aws sns subscribe \
  --topic-arn "arn:aws:sns:..." \
  --protocol email \
  --notification-endpoint admin@vcmuellheim.de
```

### 5. Initial Container Deployment

Push the first container image to ECR:

```bash
# Get ECR login
aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.eu-central-1.amazonaws.com

# Build and tag image
cd ..  # Back to root directory
docker build -t vcmuellheim:latest -f Containerfile .
docker tag vcmuellheim:latest ACCOUNT.dkr.ecr.eu-central-1.amazonaws.com/vcmuellheim:latest

# Push image
docker push ACCOUNT.dkr.ecr.eu-central-1.amazonaws.com/vcmuellheim:latest

# Update ECS service to use the new image
aws ecs update-service \
  --cluster vcmuellheim-cluster \
  --service vcmuellheim-service \
  --force-new-deployment
```

## Migration Process

### Database Migration

1. **Export data from current PostgreSQL**:
   ```bash
   pg_dump -h current-host -U username -d vcmuellheim > vcmuellheim_backup.sql
   ```

2. **Import to RDS**:
   ```bash
   # Get RDS endpoint from outputs
   psql -h rds-endpoint -U vcmuellheim -d vcmuellheim -f vcmuellheim_backup.sql
   ```

### File Migration

If there are existing file uploads, sync them to S3:
```bash
aws s3 sync ./existing-uploads s3://vcmuellheim-assets-ACCOUNT/
```

### DNS Cutover

1. Update your domain registrar to point to AWS Route 53 nameservers
2. Verify DNS propagation
3. Test the new infrastructure thoroughly

## Cost Optimization

The infrastructure is designed with cost optimization in mind:

- **RDS**: t4g.micro instance with auto-scaling storage
- **ECS**: Single Fargate task (can be scaled based on demand)
- **ALB**: Shared across services
- **CloudFront**: Europe/North America price class only
- **VPC Endpoints**: Reduce NAT Gateway costs for AWS service calls
- **Monitoring**: Basic CloudWatch metrics and alarms

### Estimated Monthly Costs (EU-Central-1)

- RDS t4g.micro: ~$15-20
- ECS Fargate (1 task): ~$15-20
- ALB: ~$20
- CloudFront: ~$1-5 (based on traffic)
- S3: ~$1-5 (based on storage)
- Other services: ~$5-10

**Total: ~$60-80/month** (compared to Hetzner VPS costs)

## Monitoring and Alerts

The monitoring stack provides:

- **CloudWatch Dashboard** with key metrics
- **Automated Alarms** for:
  - ECS service health
  - Load balancer response times
  - Database performance
  - High error rates
- **SNS Notifications** via email

Access the dashboard at: https://eu-central-1.console.aws.amazon.com/cloudwatch/home?region=eu-central-1#dashboards:name=vcmuellheim-monitoring

## Security Features

- **VPC** with private subnets for database and application
- **Security Groups** with least-privilege access
- **SSL/TLS** encryption in transit and at rest
- **Secrets Manager** for sensitive configuration
- **IAM Roles** with minimal required permissions
- **Container scanning** with ECR
- **WAF** (can be added to CloudFront if needed)

## Scaling

The infrastructure can be easily scaled:

- **ECS Service**: Increase `desiredCount` for more tasks
- **RDS**: Scale up instance type or enable Multi-AZ
- **Auto Scaling**: Add ECS auto-scaling based on CPU/memory
- **CDN**: Global reach with CloudFront

## Backup and Recovery

- **RDS**: Automated daily backups with 7-day retention
- **Point-in-time recovery** available for RDS
- **S3**: Versioning enabled for file uploads
- **Infrastructure**: All defined as code in CDK

## Troubleshooting

### Common Issues

1. **ECS tasks not starting**: Check CloudWatch logs for container errors
2. **ALB health checks failing**: Verify security groups and health check path
3. **Database connection issues**: Check security groups and credentials
4. **CI/CD pipeline failing**: Verify GitHub token and CodeBuild permissions

### Useful Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster vcmuellheim-cluster --services vcmuellheim-service

# View ECS task logs
aws logs tail /ecs/vcmuellheim --follow

# Check ALB target health
aws elbv2 describe-target-health --target-group-arn TARGET-GROUP-ARN

# Test database connection
aws rds describe-db-instances --db-instance-identifier DATABASE-ID
```

## Clean Up

To destroy all resources:

```bash
cdk destroy --all
```

**Warning**: This will delete all data including the database. Make sure to backup any important data first.

## Support

For issues with the infrastructure, check:

1. CloudWatch logs and metrics
2. AWS Health Dashboard
3. CDK documentation: https://docs.aws.amazon.com/cdk/

For application-specific issues, refer to the main project documentation.