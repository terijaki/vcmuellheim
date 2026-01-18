# News Creation Fix - DynamoDB GSI Schema Correction

## Problem Summary

News creation was flaky, particularly for drafts and archived posts:
- Drafts were sometimes not created
- When drafts were created, they didn't show in the CMS list (but appeared in DynamoDB)
- When archiving a post, it didn't show in the CMS list (but appeared in DynamoDB)

## Root Cause

The DynamoDB Global Secondary Index (GSI) configuration was invalid:

1. **Invalid CDK Parameter**: Used `sortKeys` (plural, array) instead of `sortKey` (singular, object)
2. **Multiple Sort Keys**: Attempted to define multiple sort keys in a single GSI:
   - `status`
   - `updatedAt`
   - `slug`
3. **DynamoDB Limitation**: GSIs only support ONE partition key and ONE optional sort key

This caused the GSI to be created incorrectly or with only partial attributes, making queries fail when trying to filter by `status` or `slug` in the `KeyConditionExpression`.

## Solution

### 1. News Table - Two GSIs

**GSI-NewsQueries** (for listing all news sorted by time):
- Partition Key: `type` (STRING)
- Sort Key: `updatedAt` (STRING)
- Used by: `getAllNews()`, `getPublishedNews()`

**GSI-NewsBySlug** (for slug-based lookups):
- Partition Key: `type` (STRING)
- Sort Key: `slug` (STRING)
- Used by: `getNewsBySlug()`

### 2. Repository Query Updates

**getAllNews**:
- Queries `GSI-NewsQueries` with only `type = "article"`
- Returns ALL statuses (draft, published, archived)
- Sorted by `updatedAt` descending

**getPublishedNews**:
- Queries `GSI-NewsQueries` with `type = "article"`
- Uses `FilterExpression` to filter `status = "published"` after the query
- Sorted by `updatedAt` descending

**getNewsBySlug**:
- Queries `GSI-NewsBySlug` with `type = "article" AND slug = :slug`
- Returns single item by slug

### 3. Teams and SAMS Tables

Fixed the same issue in:
- **Teams Table**: Changed from `sortKeys` array to `sortKey` with `slug`
- **SAMS Clubs Table**: Changed from `sortKeys` array to `sortKey` with `nameSlug`
- **SAMS Teams Table**: Changed from `sortKeys` array to `sortKey` with `nameSlug`

## Deployment Instructions

### 1. Deploy CDK Stack

The DynamoDB table changes require deployment:

```bash
# Review changes first
bun run cdk:diff

# Deploy to dev environment
bun run cdk:deploy ContentDbStack

# Or deploy all stacks
bun run cdk:deploy:all
```

### 2. GSI Migration

**Important**: Adding a new GSI to an existing table triggers an automatic migration:
- DynamoDB will create the new GSI in the background
- The migration can take several minutes depending on table size
- The table remains available during migration
- Old GSI (if any) needs to be removed after the new one is created

**Expected Changes**:
1. News table will have TWO GSIs: `GSI-NewsQueries` and `GSI-NewsBySlug`
2. Teams table GSI will use `slug` as sort key
3. SAMS tables GSIs will use `nameSlug` as sort key

### 3. Verify Deployment

After deployment, verify the GSI structure:

```bash
# Check News table GSIs
aws dynamodb describe-table --table-name vcm-news-dev --profile vcmuellheim \
  | jq '.Table.GlobalSecondaryIndexes'

# Expected output: Two GSIs with correct key schemas
```

### 4. Test News Creation

1. **Create Draft News**: Should appear in CMS list under "Draft" filter
2. **Publish Draft**: Should move to "Published" filter
3. **Archive Published**: Should appear under "Archived" filter
4. **Query by Slug**: Public website should be able to fetch by slug

## Files Changed

1. **lib/content-db-stack.ts**: Fixed GSI definitions for News and Teams tables
2. **lib/sams-api-stack.ts**: Fixed GSI definitions for SAMS Clubs and Teams tables
3. **lib/db/repositories.ts**: Updated query functions to use correct GSIs and FilterExpression
4. **lib/content-db-stack.test.ts**: Updated tests to verify new GSI schema
5. **lib/db/repositories.test.ts**: Added unit tests for repository query functions

## Verification Checklist

- [ ] CDK stack deployed successfully
- [ ] News table has two GSIs: `GSI-NewsQueries` and `GSI-NewsBySlug`
- [ ] Create draft news - appears in CMS list with "Draft" status
- [ ] Publish news - appears in CMS list with "Published" status
- [ ] Archive news - appears in CMS list with "Archived" status
- [ ] Public website can fetch news by slug
- [ ] All tests pass: `bun run test`

## Rollback Plan

If issues occur after deployment:

1. Revert the repository query changes to use scan instead of query temporarily
2. Deploy a hotfix that uses `newsRepository.scan()` with filter expressions
3. Schedule a maintenance window to properly fix the GSI schema

## Performance Considerations

**Before (Broken)**:
- Queries failed or scanned entire table
- Poor performance for filtered queries

**After (Fixed)**:
- `getAllNews`: Efficient GSI query on `type`, sorted by `updatedAt`
- `getPublishedNews`: GSI query on `type` + FilterExpression on `status` (slightly less efficient but functional)
- `getNewsBySlug`: Efficient GSI query on `type` and `slug`

**Future Optimization**:
Consider creating a third GSI for published news if performance becomes an issue:
- `GSI-PublishedNews`: PK: `type`, SK: `status#updatedAt` (composite)
- Would eliminate FilterExpression overhead for `getPublishedNews`
