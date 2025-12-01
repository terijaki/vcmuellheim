# Data Migration from Postgres to DynamoDB

Complete guide for migrating data from Payload CMS (Postgres) to DynamoDB.

## Overview

The migration process consists of two main steps:
1. Export Postgres data to JSON format
2. Import JSON data to DynamoDB with S3 media migration

## Prerequisites

- Postgres dump file from Payload CMS
- AWS credentials configured (`.env.production.local`)
- Access to both old and new S3 buckets

## Step 1: Export Postgres to JSON

```bash
bash scripts/convert-dump-to-json.sh <path-to-dump-file>
```

This script:
- Creates a temporary Postgres database
- Restores the dump file
- Exports all collections to JSON format
- Includes relationship data (team images, news images)
- Outputs to `.temp/postgres-backup.json`

### Exported Collections

- **news**: Articles with Lexical content and image galleries
- **events**: Calendar events with dates and locations
- **members**: Club members with avatars and roles
- **teams**: Volleyball teams with pictures and schedules
- **locations**: Training/match locations
- **busBookings**: Travel bookings with TTL
- **media**: File metadata (referenced by other collections)

## Step 2: Import to DynamoDB

### Single Collection

```bash
bun run migrate:to-dynamo --backup=.temp/postgres-backup.json --collection=<name>
```

Available collections:
- `locations` - Training/match locations (6 items)
- `busBookings` - Travel bookings (25 items)
- `members` - Club members with avatars (14 items, 12 images)
- `teams` - Volleyball teams with pictures (9 items, 18 images)
- `news` - News articles with image galleries (159 items, 834 images)
- `events` - Calendar events (0 items in current backup)

### All Collections

```bash
bun run migrate:to-dynamo --backup=.temp/postgres-backup.json --all
```

Migrates all collections in dependency order:
1. locations
2. busBookings
3. members
4. teams
5. news
6. events

### Dry Run

Preview migration without writing to DynamoDB:

```bash
bun run migrate:to-dynamo --backup=.temp/postgres-backup.json --all --dry-run
```

## Migration Details

### Zod Validation

All entities are validated with Zod schemas before insertion:
- Type safety
- Format validation (UUID, ISO datetime, etc.)
- Required fields enforcement
- Optional fields handling

### S3 Media Migration

Images are migrated to entity-specific paths:

- `members/{memberId}/{filename}` - Member avatars
- `teams/{teamId}/{filename}` - Team pictures
- `news/{newsId}/{filename}` - News image galleries

**Key Features:**
- Parallel uploads (batches of 5)
- Skip already-uploaded files (HeadObjectCommand check)
- Images duplicated per entity (no shared files)
- CDN URL generation

### News Content Conversion

News articles require special handling:

1. **Lexical to HTML**: Convert Lexical JSON editor format to HTML
2. **Excerpt Generation**: Extract plain text for summaries
3. **Slug Generation**: Create URL-friendly slugs from titles
4. **Image Galleries**: Upload all images (up to 53 per article)

### Date Handling

- **Fallback dates**: Articles without timestamps use `2024-01-01T00:00:00Z`
- **UTC conversion**: All dates stored as ISO 8601 strings ending in Z
- **TTL calculation**: Bus bookings expire 2 years after travel date

### Migration Performance

- **News (159 articles)**: ~10 minutes with parallel uploads
- **Teams (9 teams)**: <1 minute
- **Members (14 members)**: <1 minute
- **Total images**: 834 uploaded in parallel batches

## Data Transformations

### Member Schema

```typescript
{
  id: UUID
  name: string
  email?: string
  phone?: string
  avatarS3Key?: string  // S3 path: members/{id}/{file}
  roleTitle?: string
  isBoardMember: boolean
  isTrainer: boolean
  createdAt: ISO datetime
  updatedAt: ISO datetime
}
```

### Team Schema

```typescript
{
  id: UUID
  name: string
  slug: string
  description?: string
  status: "active" | "inactive"
  sbvvTeamId?: string
  ageGroup?: string
  gender: "male" | "female" | "mixed"
  league?: string
  pictureS3Keys?: string[]  // S3 paths: teams/{id}/{file}
  trainingSchedules?: TrainingSchedule[]
  createdAt: ISO datetime
  updatedAt: ISO datetime
}
```

### News Schema

```typescript
{
  id: UUID
  type: "article"
  title: string (max 200)
  slug: string (max 200)
  content: string (HTML)
  excerpt?: string (max 500)
  status: "draft" | "published" | "archived"
  imageS3Keys?: string[]  // S3 paths: news/{id}/{file}
  tags?: string[]
  createdAt: ISO datetime
  updatedAt: ISO datetime
}
```

## Verification

After migration, verify data integrity:

### DynamoDB

```bash
# Count items per table
aws dynamodb scan --table-name vcm-news-dev-aws-migration --select COUNT
aws dynamodb scan --table-name vcm-teams-dev-aws-migration --select COUNT
aws dynamodb scan --table-name vcm-members-dev-aws-migration --select COUNT

# Sample item
aws dynamodb scan --table-name vcm-news-dev-aws-migration --limit 1
```

### S3

```bash
# Count files per entity type
aws s3 ls s3://vcm-media-dev-aws-migration/news/ --recursive | wc -l
aws s3 ls s3://vcm-media-dev-aws-migration/teams/ --recursive | wc -l
aws s3 ls s3://vcm-media-dev-aws-migration/members/ --recursive | wc -l
```

## Troubleshooting

### AWS Session Expired

```bash
aws login
```

### Clear Data for Re-migration

```bash
# Clear S3
aws s3 rm s3://vcm-media-dev-aws-migration/ --recursive

# Clear DynamoDB (example for news)
aws dynamodb scan --table-name vcm-news-dev-aws-migration --attributes-to-get id | \
  jq -r '.Items[].id.S' | \
  while read id; do 
    aws dynamodb delete-item --table-name vcm-news-dev-aws-migration --key "{\"id\": {\"S\": \"$id\"}}"
  done
```

### Check Specific News Article

```bash
# View with images
aws dynamodb get-item \
  --table-name vcm-news-dev-aws-migration \
  --key '{"id": {"S": "81163a54-4135-4da0-a6c1-40ef8d87b424"}}' | \
  jq '{id: .Item.id.S, title: .Item.title.S, imageCount: (.Item.imageS3Keys.L | length)}'
```

## Migration Summary

**Total Migrated:**
- 6 locations
- 25 bus bookings
- 14 members (12 with avatars)
- 9 teams (6 with pictures)
- 159 news articles (120 with images)
- 0 events (no published events in backup)

**Total Items:** 213
**Total Images:** 834

**Status:** ✅ Complete
