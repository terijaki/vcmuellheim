# Migration Guide: Hetzner VPS to AWS

This guide walks you through migrating the VCM Müllheim website from Hetzner VPS (with Coolify) to AWS infrastructure.

## Pre-Migration Checklist

### Prerequisites
- [ ] AWS Account with appropriate permissions
- [ ] AWS CLI configured (`aws configure`)
- [ ] Node.js 18+ and npm installed
- [ ] Docker installed
- [ ] Access to current database for backup
- [ ] Domain registrar access (for DNS changes)

### Current State Backup
- [ ] Database backup: `pg_dump -h current-host -U user vcmuellheim > backup.sql`
- [ ] File uploads backup (if any): `tar -czf uploads.tar.gz /path/to/uploads`
- [ ] Environment variables documentation
- [ ] DNS record documentation

## Migration Steps

### 1. Deploy AWS Infrastructure

```bash
cd infrastructure
chmod +x scripts/*.sh
./scripts/deploy.sh
```

This will deploy all necessary AWS resources:
- VPC with public/private subnets
- RDS PostgreSQL database
- ECS Fargate cluster
- Application Load Balancer
- CloudFront distribution
- ECR repository
- CI/CD pipeline
- Monitoring and alarms

### 2. Configure Secrets

After deployment, configure the necessary secrets:

```bash
# Get secret ARNs from deployment output
GITHUB_SECRET_ARN="arn:aws:secretsmanager:..."
APP_SECRETS_ARN="arn:aws:secretsmanager:..."

# Set GitHub token for CI/CD
aws secretsmanager update-secret \
  --secret-id "$GITHUB_SECRET_ARN" \
  --secret-string "your-github-personal-access-token"

# Set application secrets
aws secretsmanager update-secret \
  --secret-id "$APP_SECRETS_ARN" \
  --secret-string '{
    "PAYLOAD_SECRET": "your-64-char-secret",
    "RESEND_API_KEY": "re_your_api_key",
    "S3_ACCESS_KEY_ID": "AKIA...",
    "S3_SECRET_ACCESS_KEY": "your-secret-key"
  }'
```

### 3. Database Migration

```bash
# Run the database migration helper
./scripts/db-migrate.sh

# This will provide you with connection details and commands like:
pg_dump -h old-host -U old-user vcmuellheim > backup.sql
psql -h new-rds-endpoint -U vcmuellheim -d vcmuellheim -f backup.sql
```

### 4. File Migration (if applicable)

If your application has file uploads stored locally:

```bash
# Get S3 bucket name from deployment output
S3_BUCKET="vcmuellheim-assets-123456789"

# Sync files to S3
aws s3 sync /path/to/current/uploads s3://$S3_BUCKET/
```

### 5. Initial Container Deployment

```bash
# Push the first container image
./scripts/push-image.sh
```

### 6. Configure Monitoring

```bash
# Subscribe to alarm notifications
ALARM_TOPIC_ARN=$(aws cloudformation describe-stacks --stack-name VcmuellheimMonitoring --query 'Stacks[0].Outputs[?OutputKey==`AlarmTopicArn`].OutputValue' --output text)

aws sns subscribe \
  --topic-arn "$ALARM_TOPIC_ARN" \
  --protocol email \
  --notification-endpoint admin@vcmuellheim.de
```

### 7. Test the New Infrastructure

Before switching DNS:

1. **Test via ALB DNS**: Use the ALB DNS name to test the application
2. **Database connectivity**: Verify database connection and data
3. **File uploads**: Test file upload/download functionality
4. **Admin panel**: Verify Payload CMS admin access
5. **Performance**: Check response times and functionality

### 8. DNS Cutover

Once everything is tested:

1. **Lower TTL**: Reduce DNS TTL to 300 seconds (5 minutes) 24 hours before cutover
2. **Update records**: Point your domain to CloudFront distribution
3. **Monitor**: Watch CloudWatch metrics and logs during cutover
4. **Verify**: Test from multiple locations to confirm DNS propagation

## Post-Migration

### 1. GitHub Actions Setup

Replace your current deployment workflow:

1. **Create AWS IAM role** for GitHub Actions:
```bash
# This is handled by the CI/CD stack, but you need to configure OIDC
# Follow: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
```

2. **Add secrets** to GitHub repository:
   - `AWS_ROLE_ARN`: The role ARN for GitHub Actions

3. **Commit the new workflow**: The new `.github/workflows/deploy-aws.yml` will handle deployments

### 2. Old Infrastructure Cleanup

After verifying everything works for 1-2 weeks:

1. **Export final backup** from old infrastructure
2. **Update DNS TTL** back to normal values
3. **Cancel Hetzner VPS** subscription
4. **Remove old GitHub Container Registry** images
5. **Update documentation** with new procedures

## Cost Comparison

### Old Setup (Hetzner)
- VPS CAX11: ~€4.5/month
- Total: ~€4.5/month (~$5/month)

### New Setup (AWS)
- RDS t4g.micro: ~$15/month
- ECS Fargate (1 task): ~$15/month  
- ALB: ~$20/month
- CloudFront: ~$1-5/month
- S3 + other services: ~$5/month
- **Total: ~$60-80/month**

### Benefits of AWS Migration
- **Scalability**: Auto-scaling based on demand
- **Reliability**: Multi-AZ deployment options
- **Security**: AWS security best practices
- **Monitoring**: Comprehensive CloudWatch monitoring
- **Backup**: Automated database backups
- **Managed services**: Less maintenance overhead
- **CI/CD**: Native AWS CI/CD pipeline
- **Global reach**: CloudFront for better performance

## Troubleshooting

### Common Issues

1. **ECS tasks failing to start**
   - Check CloudWatch logs: `/ecs/vcmuellheim`
   - Verify environment variables and secrets
   - Check security groups

2. **Database connection issues**
   - Verify security groups allow ECS → RDS traffic
   - Check database credentials in Secrets Manager
   - Ensure RDS instance is running

3. **Load balancer health checks failing**
   - Verify container port (3080) is correct
   - Check health check path `/health`
   - Review security group rules

4. **CI/CD pipeline failing**
   - Verify GitHub token in Secrets Manager
   - Check CodeBuild logs in CloudWatch
   - Ensure IAM permissions are correct

### Monitoring Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster vcmuellheim-cluster --services vcmuellheim-service

# View application logs
aws logs tail /ecs/vcmuellheim --follow

# Check database status
aws rds describe-db-instances --db-instance-identifier vcmuellheim-database

# View CloudWatch metrics
# Use the dashboard: https://console.aws.amazon.com/cloudwatch/home#dashboards:name=vcmuellheim-monitoring
```

## Rollback Plan

If issues arise during migration:

1. **DNS rollback**: Point DNS back to old infrastructure
2. **Database sync**: If needed, sync any new data back to old database
3. **Communicate**: Notify stakeholders about the rollback
4. **Debug**: Fix issues in AWS infrastructure before retry

## Support and Maintenance

### Regular Tasks
- **Monitor costs**: Review AWS billing monthly
- **Check backups**: Verify RDS automated backups
- **Review metrics**: Check CloudWatch dashboard weekly
- **Update secrets**: Rotate secrets quarterly
- **Security updates**: Update container images regularly

### Scaling Considerations
- **Increase ECS task count** during high traffic
- **Upgrade RDS instance** if database performance is needed
- **Enable Multi-AZ** for RDS in production
- **Add Auto Scaling** for ECS service based on metrics

## Contact

For issues with this migration:
- Infrastructure code: Check CDK documentation
- Application issues: Refer to main project README
- AWS-specific issues: AWS Support or documentation