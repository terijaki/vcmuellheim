#!/bin/bash

set -e

echo "🗄️ Database Migration Helper"

# Get database connection details
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name VcmuellheimDatabase --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' --output text)
DB_SECRET_ARN=$(aws cloudformation describe-stacks --stack-name VcmuellheimDatabase --query 'Stacks[0].Outputs[?OutputKey==`DatabaseSecretArn`].OutputValue' --output text)

if [ "$DB_ENDPOINT" = "None" ] || [ -z "$DB_ENDPOINT" ]; then
    echo "❌ Database endpoint not found. Make sure the Database stack is deployed."
    exit 1
fi

# Get database credentials from Secrets Manager
echo "🔐 Retrieving database credentials..."
DB_CREDENTIALS=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET_ARN --query SecretString --output text)
DB_USERNAME=$(echo $DB_CREDENTIALS | jq -r .username)
DB_PASSWORD=$(echo $DB_CREDENTIALS | jq -r .password)

echo "📊 Database Details:"
echo "Endpoint: $DB_ENDPOINT"
echo "Username: $DB_USERNAME"
echo "Database: vcmuellheim"

echo ""
echo "🔗 Connection string:"
echo "postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_ENDPOINT:5432/vcmuellheim"

echo ""
echo "📋 Migration Commands:"
echo "====================="
echo ""
echo "1. Export from current database:"
echo "   pg_dump -h current-host -U current-user -d vcmuellheim > vcmuellheim_backup.sql"
echo ""
echo "2. Import to AWS RDS:"
echo "   psql -h $DB_ENDPOINT -U $DB_USERNAME -d vcmuellheim -f vcmuellheim_backup.sql"
echo ""
echo "3. Or use environment variable:"
echo "   export DATABASE_URL=\"postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_ENDPOINT:5432/vcmuellheim\""
echo "   psql \$DATABASE_URL -f vcmuellheim_backup.sql"
echo ""
echo "⚠️  Security Note: This script shows the database password. Use with caution."