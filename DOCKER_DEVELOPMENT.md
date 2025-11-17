# Local Development with Docker

This guide explains how to run the application locally using Docker/Podman while the production deployment uses AWS infrastructure.

## Prerequisites

- Docker or Podman installed
- Docker Compose (or podman-compose)
- At least 4GB RAM available for containers

## Quick Start

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Using Podman

```bash
# Start all services
podman-compose up -d

# Or use the existing scripts
npm run container:build  # Build the container
npm run container:run    # Run the container
npm run container:dev    # Build and run with live reload
```

## Services

The docker-compose setup includes:

1. **PostgreSQL** (port 5432)
   - Database for local development
   - Mirrors Aurora PostgreSQL structure
   - Persistent data in named volume

2. **Next.js Application** (port 3080)
   - Main application
   - Hot reload enabled in dev mode
   - Health check configured

3. **MinIO** (ports 9000, 9001)
   - S3-compatible object storage
   - Console available at http://localhost:9001
   - Credentials: minioadmin/minioadmin
   - Mimics AWS S3 for local development

## Accessing Services

- **Application**: http://localhost:3080
- **Admin Panel**: http://localhost:3080/admin
- **MinIO Console**: http://localhost:9001
- **PostgreSQL**: localhost:5432

## Environment Variables

For local development, create a `.env.local` file:

```bash
# Database
DATABASE_URL=postgresql://vcmuellheim:vcmuellheim_dev_password@localhost:5432/vcmuellheim

# Payload CMS
PAYLOAD_SECRET=dev-secret-change-in-production
PAYLOAD_CONFIG_PATH=./payload.config.ts
PAYLOAD_DEV_EMAIL=admin@example.com
PAYLOAD_DEV_PASSWORD=admin

# S3 Storage (MinIO)
S3_BUCKET=vcmuellheim-dev
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_ENDPOINT=http://localhost:9000

# Application
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
TZ=Europe/Berlin

# SAMS Integration
SAMS_SERVER=https://www.volleyball-baden.de
```

## Development Workflow

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Start database and MinIO
docker-compose up -d postgres minio minio-init

# 3. Run database migrations
npm run payload migrate

# 4. Start development server
npm run dev
```

### Working with the Application

```bash
# Run development server (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm run start

# Lint code
npm run lint

# Format code
npm run biome
```

### Database Operations

```bash
# Access PostgreSQL shell
docker exec -it vcmuellheim-db psql -U vcmuellheim -d vcmuellheim

# Create a database backup
docker exec vcmuellheim-db pg_dump -U vcmuellheim vcmuellheim > backup.sql

# Restore from backup
docker exec -i vcmuellheim-db psql -U vcmuellheim vcmuellheim < backup.sql

# Create new migration
npm run payload-migrate

# Run migrations
DATABASE_URL=postgresql://vcmuellheim:vcmuellheim_dev_password@localhost:5432/vcmuellheim \
  npm run payload migrate
```

### MinIO Operations

```bash
# Access MinIO console
# Open http://localhost:9001 in browser
# Login: minioadmin / minioadmin

# Upload files via CLI (using mc - MinIO Client)
docker run --rm -it --network vcmuellheim_network \
  minio/mc \
  cp /path/to/file mc/minio:9000/vcmuellheim-dev/

# List files
docker run --rm -it --network vcmuellheim_network \
  minio/mc \
  ls mc/minio:9000/vcmuellheim-dev/
```

## Testing AWS Integration Locally

You can test AWS services locally using LocalStack:

```bash
# Add to docker-compose.yml
localstack:
  image: localstack/localstack:latest
  ports:
    - "4566:4566"
  environment:
    - SERVICES=s3,secretsmanager,rds
    - DEBUG=1
  volumes:
    - "./localstack:/var/lib/localstack"
```

## Switching Between Local and AWS

### Use Local Development

```bash
# In .env.local
DATABASE_URL=postgresql://vcmuellheim:vcmuellheim_dev_password@localhost:5432/vcmuellheim
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

### Use AWS Resources from Local

```bash
# In .env.local
DATABASE_URL=postgresql://username:password@aurora-endpoint:5432/vcmuellheim
S3_BUCKET=vcmuellheim-dev-media
S3_REGION=eu-central-1
S3_ACCESS_KEY_ID=<from-aws>
S3_SECRET_ACCESS_KEY=<from-aws>
# Don't set S3_ENDPOINT to use AWS S3
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Rebuild container
docker-compose build --no-cache app
docker-compose up -d app
```

### Database Connection Fails

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres

# Wait for health check
docker-compose ps
```

### Port Already in Use

```bash
# Find what's using the port
lsof -i :3080  # macOS/Linux
netstat -ano | findstr :3080  # Windows

# Change port in docker-compose.yml
ports:
  - "3081:3080"  # Use different external port
```

### MinIO Not Accessible

```bash
# Check MinIO logs
docker-compose logs minio

# Restart MinIO
docker-compose restart minio minio-init

# Verify bucket created
docker exec vcmuellheim-minio mc ls /data/
```

### Out of Disk Space

```bash
# Clean up old containers and images
docker system prune -a --volumes

# Check disk usage
docker system df
```

## Performance Tips

### Speed Up Builds

```bash
# Use BuildKit (Docker)
DOCKER_BUILDKIT=1 docker-compose build

# Cache node_modules
# Add to docker-compose.yml volumes:
volumes:
  - ./:/app
  - /app/node_modules  # Don't overwrite node_modules
```

### Reduce Memory Usage

```bash
# Limit container memory in docker-compose.yml
services:
  app:
    mem_limit: 2g
    memswap_limit: 2g
```

## Production Simulation

To simulate production environment locally:

```bash
# Build production container
docker build -t vcmuellheim:prod -f Containerfile .

# Run with production settings
docker run -d \
  --name vcmuellheim-prod-test \
  -p 3080:3080 \
  --env-file .env.production.local \
  vcmuellheim:prod
```

## Cleaning Up

```bash
# Stop all services
docker-compose down

# Remove volumes (deletes data!)
docker-compose down -v

# Remove images
docker rmi vcmuellheim

# Full cleanup
docker-compose down -v --rmi all
docker system prune -a --volumes -f
```

## Best Practices

1. **Never commit sensitive data**
   - Use `.env.local` for local secrets
   - Add `.env.local` to `.gitignore`

2. **Keep Docker images updated**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

3. **Regular backups**
   ```bash
   # Backup script
   docker exec vcmuellheim-db pg_dump -U vcmuellheim vcmuellheim > backup-$(date +%Y%m%d).sql
   ```

4. **Use the same PostgreSQL version**
   - Local: PostgreSQL 15
   - AWS: Aurora PostgreSQL 15
   - Ensures compatibility

5. **Test migrations locally first**
   ```bash
   # Create migration
   npm run payload-migrate
   
   # Test locally
   docker-compose exec app npm run payload migrate
   
   # Then deploy to AWS
   ```

## Next Steps

- See [../infrastructure/README.md](../infrastructure/README.md) for AWS deployment
- See [../infrastructure/MIGRATION_GUIDE.md](../infrastructure/MIGRATION_GUIDE.md) for migration steps
- See [../infrastructure/AWS_DEPLOYMENT.md](../infrastructure/AWS_DEPLOYMENT.md) for environment variables
