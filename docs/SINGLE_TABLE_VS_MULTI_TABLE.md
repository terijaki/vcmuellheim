# Single-Table vs Multi-Table Design Analysis

## Your Specific Use Cases

### Key Relationships:
1. **Teams ↔ SAMS Teams** - Teams have `sbvvTeamId` to map to external SAMS API data
2. **Teams ↔ Instagram** - Teams have `instagram` handle used in social sync
3. **Members ↔ Teams** - Members (trainers) are linked to teams via `coachIds[]` on teams

### Current Access Patterns:
- Get team by slug → render team page with coaches
- Get SAMS team ID → find which VCM team it belongs to
- Get Instagram handle → find which team it belongs to (for social sync)
- Get member → find which teams they coach
- Get news → get author details, get images
- List all teams → display on teams overview

---

## Single-Table Design Evaluation

### Pros of Single-Table:
1. **Better for complex queries across entities**
   - Get team with all coaches in one query
   - Get news with authors and images in one query
   - Get Instagram posts with team metadata in one query

2. **Reduced costs** (slightly)
   - Fewer read operations (can fetch related data in one query)
   - One table to manage instead of 8

3. **Better for relationships**
   - Teams ↔ SAMS teams mapping easier
   - Teams ↔ Instagram easier
   - Members ↔ Teams easier with inverted indexes

### Cons of Single-Table:
1. **Complexity**
   - Composite keys (`PK = TEAM#uuid`, `SK = TEAM#uuid`)
   - Multiple GSIs for different access patterns
   - Hard to visualize data structure
   - Steeper learning curve

2. **Migration difficulty**
   - Payload has simple collections → mapping to composite keys is complex
   - More transformation logic needed

3. **Admin CMS complexity**
   - CRUD operations more complex (need to manage composite keys)
   - Listing/filtering requires understanding GSI patterns

4. **Limited flexibility**
   - Adding new entity types requires careful planning
   - GSI limits (20 per table)

---

## Multi-Table Design Evaluation

### Pros of Multi-Table:
1. **Simplicity**
   - Direct mapping from Payload collections
   - Simple primary keys (just `id`)
   - Easy to understand and maintain
   - Great DX for admin CMS CRUD operations

2. **Easy migration**
   - 1:1 from Payload collections to DynamoDB tables
   - Minimal transformation logic

3. **Flexibility**
   - Easy to add new entity types
   - Easy to change schema per table
   - No GSI limits per entity

### Cons of Multi-Table:
1. **Multiple queries for relationships**
   - Get team → then get coaches separately
   - Get news → then get authors/images separately
   - Client-side join logic needed

2. **Slightly higher costs**
   - More read operations for related data
   - (But negligible for club website scale)

3. **No cross-entity queries**
   - Can't query "all teams with Instagram handle X" without scanning
   - Can't query "all members coaching team Y" without scanning
   - (But you can use GSIs per table)

---

## Addressing Your Specific Relationships

### 1. Teams → SAMS Teams Mapping

**Multi-Table:**
```typescript
// Teams table with GSI on sbvvTeamId
// Query: GSI-SamsTeam where PK = sbvvTeamId
teams.addGlobalSecondaryIndex({
  indexName: 'GSI-SamsTeam',
  partitionKey: { name: 'sbvvTeamId', type: AttributeType.STRING }
});
```

**Single-Table:**
```typescript
// Same item for both:
PK: TEAM#uuid        SK: TEAM#uuid
PK: SAMSTEAM#samsId  SK: TEAM#uuid  (GSI)
```
✅ Single-table is slightly cleaner here, but multi-table with GSI works fine.

---

### 2. Teams → Instagram Mapping

**Multi-Table:**
```typescript
// Teams table with GSI on instagram handle
teams.addGlobalSecondaryIndex({
  indexName: 'GSI-Instagram',
  partitionKey: { name: 'instagram', type: AttributeType.STRING }
});

// Social sync job:
const team = await query(GSI-Instagram, instagram='@vcmuellheim_m1')
```

**Single-Table:**
```typescript
// GSI: PK = INSTAGRAM#vcmuellheim_m1, SK = TEAM#uuid
```
✅ Both work equally well.

---

### 3. Members ↔ Teams (Trainers)

**Multi-Table:**
```typescript
// Teams table stores: coachIds = ['member-uuid-1', 'member-uuid-2']
// To get team with coaches:
const team = await getItem(teamId);
const coaches = await batchGet(team.coachIds); // One batch request

// To get teams coached by member (requires scan or GSI):
// Option A: Scan teams table (slow, but small dataset)
// Option B: Add denormalized teamIds to members table
```

**Single-Table:**
```typescript
// Can create inverted index:
PK: MEMBER#uuid      SK: MEMBER#uuid
PK: MEMBER#uuid      SK: TEAM#team-uuid  (for each team they coach)
PK: TEAM#uuid        SK: COACH#member-uuid  (for each coach)

// Query teams by coach:
query(PK = MEMBER#uuid, SK begins_with TEAM#)
```
✅ Single-table is better here for bidirectional queries.

---

## Recommendation: **Multi-Table Design**

### Why Multi-Table Wins for Your Use Case:

1. **Your data access is mostly entity-centric, not relation-centric**
   - Most pages display one entity type (teams list, news list, etc.)
   - Relationships are simple (IDs in arrays)
   - You're not doing complex joins frequently

2. **Your relationships are manageable with denormalization**
   - Teams have `coachIds[]` - just fetch them separately (or in batch)
   - Members have `roleIds[]` - same pattern
   - News has `authorIds[]`, `imageIds[]` - same pattern
   - This is standard in NoSQL and works fine

3. **Your scale doesn't justify single-table complexity**
   - Club website: ~10-20 teams, ~50 members, ~100 news articles
   - Extra read operations cost pennies per month
   - Simplicity > micro-optimization

4. **Admin CMS is much easier with multi-table**
   - CRUD operations are straightforward
   - No composite key logic in forms
   - Easier to build and maintain

5. **Migration is simpler**
   - Direct 1:1 mapping from Payload
   - Less transformation logic
   - Lower risk

### How to Handle Your Specific Cases with Multi-Table:

#### Teams → SAMS Teams Mapping
Add GSI to Teams table:
```typescript
teams.addGlobalSecondaryIndex({
  indexName: 'GSI-SamsTeam',
  partitionKey: { name: 'sbvvTeamId', type: AttributeType.STRING },
  sortKey: { name: 'sbvvTeamId', type: AttributeType.STRING },
});
```

#### Teams → Instagram Mapping
Add GSI to Teams table:
```typescript
teams.addGlobalSecondaryIndex({
  indexName: 'GSI-Instagram',
  partitionKey: { name: 'instagram', type: AttributeType.STRING },
  sortKey: { name: 'instagram', type: AttributeType.STRING },
});
```

#### Members ↔ Teams (Trainers)
**Option A: Client-side join (recommended for simplicity)**
```typescript
// Frontend: Get team with coaches
const team = await getTeam(teamId);
const coaches = await batchGetMembers(team.coachIds);

// No need for reverse lookup (which teams does this member coach?)
// Just scan teams table occasionally for admin UI (small dataset)
```

**Option B: Denormalize if needed**
```typescript
// Add teamIds to members table
member = {
  id: 'uuid',
  name: 'John Doe',
  teamIds: ['team-1', 'team-2'], // Teams they coach
  // ... other fields
}
```

---

## Cost Analysis

### Multi-Table Costs (estimated):
- 8 tables × $0.25 per table = **$2/month base**
- Read/write costs: ~10k requests/month = **$0.03/month**
- Storage: <1GB = **$0.25/month**
- **Total: ~$2.50/month**

### Single-Table Costs:
- 1 table = **$0.25/month base**
- Fewer reads (batch operations) = **$0.02/month**
- Storage: <1GB = **$0.25/month**
- **Total: ~$0.50/month**

**Savings: $2/month** ← Not worth the complexity!

---

## Final Decision: **Multi-Table Design with Strategic GSIs**

### Action Items:
1. ✅ Keep multi-table design
2. [ ] Add `GSI-SamsTeam` to Teams table (for SAMS mapping)
3. [ ] Add `GSI-Instagram` to Teams table (for social sync)
4. [ ] Use client-side joins for member ↔ team relationships
5. [ ] Consider denormalizing `teamIds` on members if reverse lookup becomes common

### Why This Works:
- **Simple to implement and maintain**
- **Easy migration from Payload**
- **Good enough performance** (batch gets are fast)
- **Flexible for future changes**
- **Clear, understandable schema**

---

## When to Reconsider Single-Table:

If you ever need:
- Complex multi-entity queries (e.g., "teams with Instagram + active sponsors + upcoming events")
- Heavy relational queries (many joins per request)
- Transactional consistency across entities
- Massive scale (millions of items)

**For a club website, multi-table is the right choice.**
