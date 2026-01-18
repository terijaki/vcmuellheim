# News Creation Fix - DynamoDB GSI Query Pattern Mismatch

## Problem Summary

News creation was flaky, particularly for drafts and archived posts:
- Drafts were sometimes not created
- When drafts were created, they didn't show in the CMS list (but appeared in DynamoDB)
- When archiving a post, it didn't show in the CMS list (but appeared in DynamoDB)

## Root Cause

The DynamoDB Global Secondary Index (GSI) configuration used multi-attribute composite keys (a new DynamoDB feature from late 2025), but the query patterns didn't match the composite key ordering rules.

**Original GSI Configuration**:
```typescript
sortKeys: [
  { name: "status", type: dynamodb.AttributeType.STRING },
  { name: "updatedAt", type: dynamodb.AttributeType.STRING },
  { name: "slug", type: dynamodb.AttributeType.STRING },
]
```

**The Problem**: With multi-attribute composite keys, you can only query attributes **left-to-right** in order. You cannot skip attributes.

- ✅ `getAllNews()`: Queries only `type` (partition key) - Works
- ✅ `getPublishedNews()`: Queries `type AND status` - Works (first sort key)
- ❌ **`getNewsBySlug()`**: Queries `type AND slug` - **FAILS** because it skips `status` and `updatedAt`

The `getNewsBySlug` function violates DynamoDB's left-to-right composite key rule, causing slug-based queries to fail.

## Solution

### Understanding Multi-Attribute Composite Keys

DynamoDB added multi-attribute composite key support in late 2025. This allows GSIs to have:
- Up to 4 attributes for the partition key
- Up to 4 attributes for the sort key

However, queries must follow the **left-to-right rule**: you can only query attributes in order, without skipping.

### The Fix: Split Into Two GSIs

Since `getNewsBySlug` needs to query by `slug` without specifying `status` or `updatedAt`, we need a separate GSI.

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
- **Changed from**: Previously couldn't filter properly due to composite key mismatch

**getPublishedNews**:
- Queries `GSI-NewsQueries` with `type = "article"`
- Uses `FilterExpression` to filter `status = "published"` after the query
- Sorted by `updatedAt` descending
- **Changed from**: Previously tried to use composite sort key `type AND status` which didn't work with the new simpler GSI

**getNewsBySlug**:
- Queries `GSI-NewsBySlug` with `type = "article" AND slug = :slug`
- Returns single item by slug
- **Changed from**: Previously failed because it tried to query `slug` while skipping other composite key attributes

### 3. Teams and SAMS Tables

Fixed the same composite key ordering issue in:
- **Teams Table**: Simplified from multi-attribute composite key `[slug, name]` to single `slug` sort key
- **SAMS Clubs Table**: Simplified from array `[nameSlug]` to single `nameSlug` sort key  
- **SAMS Teams Table**: Simplified from array `[nameSlug]` to single `nameSlug` sort key

These changes ensure queries don't violate the left-to-right composite key rule.

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
