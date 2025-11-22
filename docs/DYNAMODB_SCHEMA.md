# DynamoDB Schema Design

## Strategy: Multi-Table Design

**Decision:** Use separate tables for each entity type rather than single-table design.

**Reasoning:**
- Simpler to understand and maintain for a club website
- Easier migration path from Payload collections (1:1 mapping)
- Clear access patterns without complex composite keys
- Better for future changes and iterations
- Cost difference negligible at this scale

---

## Tables Overview

1. **vcm-news** - News articles
2. **vcm-events** - Club events and dates
3. **vcm-teams** - Team information
4. **vcm-members** - Club members (coaches, contacts, etc.)
5. **vcm-media** - Media file metadata (actual files in S3)
6. **vcm-sponsors** - Sponsor information
7. **vcm-roles** - Member roles (e.g., "Trainer", "Vorstand")

**Note:** Authentication is handled by AWS Cognito, so no Users table is needed.

---

## 1. News Table (`vcm-news`)

**Current Payload Fields:**
- title, content (richText), publishedDate, authors[], images[], excerpt, _status

**DynamoDB Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK (for consistency) |
| title | String | Article title |
| slug | String | URL-friendly slug (auto-generated from title) |
| content | Map | Tiptap JSON content |
| excerpt | String | Auto-generated from content |
| publishedDate | String | ISO 8601 timestamp |
| status | String | `draft` \| `published` |
| authorIds | List\<String\> | Array of user IDs |
| imageIds | List\<String\> | Array of media IDs |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**Global Secondary Indexes:**

1. **GSI-PublishedDate** (for listing news by date)
   - PK: `status` (partition key - filter by published)
   - SK: `publishedDate` (sort key - newest first)
   - Projection: ALL

2. **GSI-Slug** (for fetching single article by slug)
   - PK: `slug` (partition key)
   - SK: `slug` (sort key)
   - Projection: ALL

**Access Patterns:**
- Get news by ID: `GetItem(PK=id)`
- Get news by slug: `Query(GSI-Slug, PK=slug)`
- List published news: `Query(GSI-PublishedDate, PK='published', SK descending)`
- List all news (admin): `Scan` or `Query` by status

---

## 2. Events Table (`vcm-events`)

**Current Payload Fields:**
- title, description (richText), date.startDate, date.endDate, address{}, images[], authors[]

**DynamoDB Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK |
| title | String | Event title |
| slug | String | URL-friendly slug |
| description | Map | Tiptap JSON content (optional) |
| startDate | String | ISO 8601 timestamp |
| endDate | String | ISO 8601 timestamp (optional) |
| address | Map | `{ name, street, postalCode, city }` |
| imageIds | List\<String\> | Array of media IDs |
| authorIds | List\<String\> | Array of user IDs |
| status | String | `draft` \| `published` |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**Global Secondary Indexes:**

1. **GSI-StartDate** (for listing events by date)
   - PK: `status` (partition key)
   - SK: `startDate` (sort key - upcoming events first)
   - Projection: ALL

**Access Patterns:**
- Get event by ID: `GetItem(PK=id)`
- List upcoming events: `Query(GSI-StartDate, PK='published', SK > now)`
- List past events: `Query(GSI-StartDate, PK='published', SK < now, descending)`

---

## 3. Teams Table (`vcm-teams`)

**Current Payload Fields:**
- name, slug, gender, age, league, sbvvTeam, description, coaches[], contactPeople[], schedules[], images[], instagram

**DynamoDB Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK |
| name | String | Team name |
| slug | String | URL-friendly slug (unique) |
| gender | String | `men` \| `woman` \| `mixed` |
| age | Number | Minimum age (optional) |
| league | String | League name (optional) |
| sbvvTeamId | String | Reference to SAMS team ID (optional) |
| description | String | Team description |
| coachIds | List\<String\> | Array of member IDs |
| contactPersonIds | List\<String\> | Array of member IDs |
| schedules | List\<Map\> | `[{ day: [], startTime, endTime, locationId }]` |
| imageIds | List\<String\> | Array of media IDs |
| instagram | String | Instagram handle (optional) |
| status | String | `draft` \| `published` |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**Global Secondary Indexes:**

1. **GSI-Slug** (for fetching by slug)
   - PK: `slug` (partition key)
   - SK: `slug` (sort key)
   - Projection: ALL

2. **GSI-Status** (for listing teams)
   - PK: `status` (partition key)
   - SK: `name` (sort key - alphabetical)
   - Projection: ALL

3. **GSI-SamsTeam** (for mapping to SAMS teams)
   - PK: `sbvvTeamId` (partition key)
   - SK: `sbvvTeamId` (sort key)
   - Projection: ALL
   - Usage: Find VCM team by SAMS team UUID

**Access Patterns:**
- Get team by ID: `GetItem(PK=id)`
- Get team by slug: `Query(GSI-Slug, PK=slug)`
- List all published teams: `Query(GSI-Status, PK='published')`
- Find team by SAMS ID: `Query(GSI-SamsTeam, PK=sbvvTeamId)`
- Get Instagram handle: Just read from team item (no reverse lookup needed)

---

## 4. Members Table (`vcm-members`)

**Current Payload Fields:**
- name, email, phone, roles[], avatar

**DynamoDB Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK |
| name | String | Member name |
| email | String | Email address (optional) |
| phone | String | Phone number (optional) |
| roleIds | List\<String\> | Array of role IDs (from Roles table) |
| avatarId | String | Media ID for avatar (optional) |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**Global Secondary Indexes:**

None - Only need to get by ID or scan all (14 members total)

**Access Patterns:**
- Get member by ID: `GetItem(PK=id)`
- List all members: `Scan` (fast with only 14 items)
- Get multiple members by IDs: `BatchGetItem` (for team coaches)

---

## 5. Media Table (`vcm-media`)

**Current Payload Fields:**
- filename, alt, size, mimeType, width, height, createdAt
- Relations: news[], members[], events[], sponsors[]

**DynamoDB Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK |
| filename | String | Original filename (UUID-based) |
| s3Key | String | S3 object key |
| s3Bucket | String | S3 bucket name |
| url | String | CloudFront URL |
| alt | String | Alt text (optional) |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**Note:** Removed mimeType, size, width, height - not needed for display. S3 metadata has this info if required.

**Global Secondary Indexes:**

None - Only need to get by ID or scan all media

**Access Patterns:**
- Get media by ID: `GetItem(PK=id)`
- List all media (admin): `Scan`
- Get multiple media by IDs: `BatchGetItem` (for news/event images)

**DynamoDB Stream Configuration:**
- Stream enabled: `NEW_AND_OLD_IMAGES` (already configured in CDK)
- **TODO: Lambda function for S3 cleanup**
  - Trigger: Stream REMOVE event
  - Action: Delete S3 object at `s3Key` in `s3Bucket`
  - Handles orphaned files when media is deleted from any source

---

## 6. Sponsors Table (`vcm-sponsors`)

**Current Payload Fields:**
- name, website, logo, expiryDate

**DynamoDB Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK |
| name | String | Sponsor name |
| website | String | Website URL (optional) |
| logoId | String | Media ID for logo (optional) |
| expiryTimestamp | Number | Unix timestamp (when sponsorship expires and for TTL auto-deletion) |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**TTL Configuration:**
- Attribute: `expiryTimestamp`
- DynamoDB automatically deletes expired sponsors (no manual cleanup needed)

**Global Secondary Indexes:**

None - Scan all sponsors and filter client-side for non-expired

**Access Patterns:**
- Get sponsor by ID: `GetItem(PK=id)`
- List all sponsors: `Scan` (small dataset, filter `expiryDate > now` client-side)
- Expired sponsors: Automatically deleted by DynamoDB TTL

**DynamoDB Stream Configuration:**
- Stream enabled: `NEW_AND_OLD_IMAGES` (already configured in CDK)
- **TODO: Lambda function for cascade deletion**
  - Trigger: Stream REMOVE event (from TTL expiration)
  - Action: Delete `logoId` from Media table
  - Media stream will then handle S3 object deletion

---

## Additional Tables (from existing CDK)

### 8. SAMS Clubs (`vcm-sams-clubs`)
- Already exists in CDK
- Contains volleyball club data from SAMS API

### 9. SAMS Teams (`vcm-sams-teams`)
- Already exists in CDK
- Contains volleyball team data from SAMS API

### 10. Roles Table (`vcm-roles`)

**Schema:**

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | `id` (String) | UUID |
| **SK** | `id` (String) | Same as PK |
| name | String | Role name |
| createdAt | String | ISO 8601 timestamp |

**Access Patterns:**
- Get role by ID: `GetItem(PK=id)`
- List all roles: `Scan` (small dataset)

---

## Common Patterns

### Timestamps
All tables use ISO 8601 format for dates:
```typescript
createdAt: new Date().toISOString() // "2025-11-22T10:30:00.000Z"
```

### Status Field
Most content tables use `status: 'draft' | 'published'` to support draft/publish workflow in admin CMS.

### Relationships
- Store IDs as strings (UUIDs)
- Use arrays for many-to-many (e.g., `imageIds: ['id1', 'id2']`)
- Denormalize when needed (e.g., fetch related data separately and combine client-side)

### Slug Generation
- Auto-generate from title/name using slugify utility
- Store as attribute for URL routing
- Index with GSI for fast lookup

---

## Cost Considerations

**On-Demand Pricing:**
- Best for unpredictable or low traffic
- Pay per request ($1.25 per million writes, $0.25 per million reads)
- No capacity planning needed

**Provisioned Capacity:**
- Good for consistent, predictable traffic
- ~$0.47/month per RCU and WCU
- Free tier: 25 RCU + 25 WCU

**Recommendation:** Start with on-demand, switch to provisioned if costs increase.

---

## Migration Strategy

1. **Export from Payload Postgres**
   - Use `payload.find()` for each collection
   - Transform to DynamoDB format
   - Handle relationships (convert to ID arrays)

2. **Transform Rich Text**
   - Payload uses Lexical JSON format
   - Will need to migrate to Tiptap JSON format
   - Consider storing both during transition

3. **Batch Write to DynamoDB**
   - Use `BatchWriteItem` (25 items per batch)
   - Implement retry logic for throttling
   - Validate data integrity after migration

4. **Validation**
   - Count records in both systems
   - Spot-check random records
   - Test all access patterns with real data

---

## Next Steps

1. ✅ Schema design complete
2. [ ] Create DynamoDB tables via CDK
3. [ ] Create TypeScript types
4. [ ] Build data access layer (AWS SDK v3)
5. [ ] Create Zod validation schemas
6. [ ] Test with sample data
