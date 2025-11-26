# Phase 1 Implementation Progress

## ✅ Completed

### 1. DNS & Custom Domain Infrastructure (Deployed)

**Manually Created Resources (Shared across all environments):**
- Route53 Hosted Zone: `new.vcmuellheim.de` (Z02942671E3POXRRRHI0L)
- ACM Certificate (eu-central-1): `*.new.vcmuellheim.de` + `new.vcmuellheim.de` for API Gateway
- ACM Certificate (us-east-1): `*.new.vcmuellheim.de` + `new.vcmuellheim.de` for CloudFront
- NS records configured in Hetzner pointing to Route53

**Domain Naming Pattern:**
- Production: `api.new.vcmuellheim.de`, `media.new.vcmuellheim.de`, `admin.new.vcmuellheim.de`
- Dev: `dev-api.new.vcmuellheim.de`, `dev-media.new.vcmuellheim.de`, `dev-admin.new.vcmuellheim.de`
- Feature branches: `dev-{branch}-api.new.vcmuellheim.de` (e.g., `dev-aws-migration-api.new.vcmuellheim.de`)

**DNS Stack Implementation:**
- Imports manually created hosted zone and certificates (not creating resources)
- Shares resources across all stacks via props
- Configuration stored in `project.config.ts` (version controlled, non-sensitive)

### 2. DynamoDB Infrastructure (Deployed)

All 6 tables successfully deployed to AWS:

- `vcm-news-dev-aws-migration`
- `vcm-events-dev-aws-migration`
- `vcm-teams-dev-aws-migration`
- `vcm-members-dev-aws-migration`
- `vcm-media-dev-aws-migration`
- `vcm-sponsors-dev-aws-migration`
- `vcm-locations-dev-aws-migration`
- `vcm-bus-bookings-dev-aws-migration`

**Removed:**
- ❌ Roles table (role fields moved to Member entity: `isVorstand`, `isTrainer`, `roleTitle`)
- ❌ Users table (Cognito handles authentication)

**Key Features:**
- On-demand billing
- Point-in-time recovery enabled
- DynamoDB Streams enabled (for S3 cleanup)
- Strategic GSIs for query optimization
- TTL on Sponsors table (expiryTimestamp)

### 2. TypeScript Type System (`lib/db/types.ts`)

Complete type definitions for all entities (inferred from Zod schemas):

- `News` - Articles with rich text content
- `Event` - Calendar events (matches, training, meetings)
- `Team` - Team information with SAMS integration
- `Member` - Club members with roles (board, trainers, custom titles)
- `Media` - Images and documents with S3 references
- `Sponsor` - Sponsor information with tier system

All entities extend `BaseEntity` with `id`, `createdAt`, `updatedAt`.

**Member role fields:**
- `isVorstand?: boolean` - Board member
- `isTrainer?: boolean` - Trainer/coach
- `roleTitle?: string` - Custom title (e.g., "1. Vorsitzender", "Kassier")

### 3. Zod Validation Schemas (`lib/db/schemas.ts`)

Runtime validation schemas using Zod v4:

- Top-level string formats: `z.uuid()`, `z.iso.datetime()`, `z.url()`, `z.email()`
- Object spread composition with `baseEntityFields`
- Strict field validation (lengths, formats, enums)
- MIME type regex validation for media

### 4. Data Access Layer

#### Core Infrastructure (`lib/db/client.ts`)
- Environment-aware table naming (8 tables: news, events, teams, members, media, sponsors, locations, bus-bookings)
- DynamoDB Document Client configuration
- Automatic undefined value removal
- Native number handling

#### Generic Repository (`lib/db/repository.ts`)
Complete CRUD operations:
- `get(id)` - Single item retrieval
- `create(item)` - Insert with auto-timestamps
- `update(id, updates)` - Partial updates with timestamp
- `delete(id)` - Remove item
- `query(options)` - GSI and key-based queries
- `scan(options)` - Full table scans
- `batchGet(ids)` - Multiple item retrieval

#### Repository Instances (`lib/db/repositories.ts`)
Pre-configured repositories for all entities:
- `newsRepository`
- `eventsRepository`
- `teamsRepository`
- `membersRepository`
- `mediaRepository`
- `sponsorsRepository`

**Domain-Specific Query Helpers:**
- `getAllNews(limit)` - All news articles by date (descending) - uses GSI with `type = "article"`
- `getPublishedNews(limit)` - Published articles by date (descending) - uses GSI with `type = "article"` and `status = "published"`
- `getNewsBySlug(slug)` - Find article by slug - uses GSI with `type = "article"`
- `getUpcomingEvents(limit)` - Future events by date (ascending)
- `getTeamBySlug(slug)` - Find team by slug
- `getActiveTeams()` - All active teams sorted by name
- `getTeamBySamsId(sbvvTeamId)` - Find team by SAMS ID
- `getActiveSponsors()` - All active sponsors
- `getAllMembers()` - All members (small dataset)
- `getBoardMembers()` - Members with `isVorstand = true`
- `getTrainers()` - Members with `isTrainer = true`

#### Public API (`lib/db/index.ts`)
Single entry point exporting:
- All types
- All schemas
- Client configuration
- Repository base class
- Repository instances
- Query helpers

### 5. tRPC Type-Safe API Layer

#### Core Setup (`lib/trpc/`)
- **context.ts** - Request context with Cognito auth support
- **trpc.ts** - Base procedures (`publicProcedure`, `protectedProcedure`)
- **index.ts** - Main app router combining all entity routers
- **client.ts** - React client for frontend integration

#### Entity Routers (`lib/trpc/routers/`)
Complete CRUD + domain queries for all 6 entities:

**News Router:**
- `list({ limit })` - All news articles (admin only)
- `published({ limit })` - Published news (public)
- `getById({ id })` - Single article (public)
- `getBySlug({ slug })` - Article by slug (public)
- `create(data)` - Create article (protected, auto-sets `type: "article"`)
- `update({ id, data })` - Update article (protected, auto-sets `type: "article"`)
- `delete({ id })` - Delete article (protected)

**Events Router:**
- `upcoming({ limit })` - Upcoming events (public)
- `getById({ id })` - Single event (public)
- `create(data)`, `update()`, `delete()` (protected)

**Teams Router:**
- `list()` - Active teams (public)
- `getById({ id })`, `getBySlug({ slug })`, `getBySamsId({ sbvvTeamId })` (public)
- `create(data)`, `update()`, `delete()` (protected)

**Members Router:**
- `list()` - All members (public)
- `board()` - Board members (public)
- `trainers()` - Trainers (public)
- `getById({ id })` (public)
- `create(data)`, `update()`, `delete()` (protected)

**Media Router:**
- `getById({ id })` - Single media item (public)
- `getMany({ ids })` - Batch get media (public)
- `create(data)`, `update()`, `delete()` (protected, delete triggers S3 cleanup)

**Sponsors Router:**
- `list()` - Active sponsors (public)
- `getById({ id })` (public)
- `create(data)`, `update()`, `delete()` (protected)

**Locations Router:**
- `list()` - All locations (public)
- `getById({ id })` (public)
- `create(data)`, `update()`, `delete()` (protected)

**Bus Bookings Router:**
- `list()` - All bus bookings (public)
- `getById({ id })` (public)
- `create(data)`, `update()`, `delete()` (protected)

**Config Router:**
- `cognito()` - Returns Cognito region, userPoolId, and clientId (public)
- `info()` - Returns environment, version, and region (public)

#### Lambda Handler (`lambda/content/handler.ts`)
- AWS Lambda adapter for API Gateway
- Deployed behind API Gateway HTTP API with custom domain
- Environment-specific User Pools (per branch isolation)
- Cognito Client ID exposed via `/api/config.cognito` endpoint

### 6. S3 & CloudFront Media Distribution (Deployed)

**Media Stack:**
- S3 bucket for media storage with CORS configuration
- CloudFront distribution with Origin Access Control (OAC)
- Custom domain: `dev-aws-migration-media.new.vcmuellheim.de`
- Short cache TTL for dev (5 min), optimized caching for prod
- Automatic S3 cleanup on stack deletion (dev only)

**Features:**
- Presigned upload URLs for direct S3 uploads
- Public read access via CloudFront (OAC)
- HTTPS-only with automatic HTTP→HTTPS redirect
- Global CDN with edge locations in North America and Europe

### 7. Cognito Authentication (Deployed)

**User Pool Configuration:**
- Per-environment/branch User Pools (allows stack destruction)
- Email-based authentication
- Self-service password reset via email
- Lambda triggers ready for custom validation

**Dynamic Configuration:**
- CMS fetches Cognito Client ID from API at runtime (`/api/config.cognito`)
- Zero hardcoded credentials in CMS code
- API URL auto-computed from hostname (admin → api replacement)
- Supports localhost with `VITE_CDK_ENVIRONMENT` + Git branch detection

### 8. CMS Admin Panel (Deployed)

**Admin CMS Architecture:**
- Vite + React + Mantine UI
- tRPC integration with type-safe API calls
- Deployed via Vite build with dynamic configuration
- News CRUD operations fully functional

**CMS Features:**
- ✅ News article management (create, read, update, delete)
- ✅ Rich text editor (TinyMCE/Tiptap)
- ✅ Image upload with S3 presigned URLs
- ✅ Draft/published/archived status management
- ✅ Automatic slug generation from title
- ✅ Real-time list view with status badges
- ✅ Type-safe forms with Zod validation

**Known Issues Fixed:**
- ✅ News items now use `type: "article"` attribute for DynamoDB GSI queries
- ✅ Repository pattern cleaned up - removed unnecessary custom NewsRepository class
- ✅ Type safety improved - removed `as never` assertion by updating repository signatures
- ✅ tRPC input schemas exclude auto-generated fields (`type`, `createdAt`, `updatedAt`)

### 9. CMS Zero-Config Architecture

**Dynamic URL Computation:**
- API URL: Computed from hostname or Git branch + environment
- Cognito Config: Fetched from `/api/config.cognito` endpoint
- No environment variables needed for deployments

**Git Branch Integration:**
- Shared utility (`utils/git.ts`) for branch detection and sanitization
- Used by both CDK and Vite build process
- Automatic branch suffix in URLs matching CDK pattern
- `VITE_GIT_BRANCH` injected at build time via `vite.config.ts`

#### Lambda Handler (`lambda/trpc/handler.ts`)
- AWS Lambda adapter for API Gateway
- Cognito JWT integration ready
- Deployed behind API Gateway HTTP API

#### Documentation (`docs/TRPC_SETUP.md`)
Complete setup guide with:
- Backend/frontend architecture
- React provider setup
- Usage examples (queries & mutations)
- All available procedures
- Authentication flow

**Key Benefits:**
- ✅ End-to-end type safety (DB → API → Frontend)
- ✅ Zod schemas as single source of truth
- ✅ Automatic TypeScript inference in React
- ✅ SuperJSON transformer (Dates, Maps, Sets)
- ✅ React Query integration (caching, mutations)

## 📊 Usage Examples

```typescript
import { newsRepository, getPublishedNews, newsSchema } from "@/lib/db";

// Create a news article
const newArticle = await newsRepository.create({
  id: crypto.randomUUID(),
  title: "VCM wins championship",
  slug: "vcm-wins-championship",
  content: "<p>Great victory!</p>",
  publishedDate: new Date().toISOString(),
  status: "published",
  authorId: "cognito-user-id",
  tags: ["victory", "championship"],
  createdAt: "", // Auto-populated
  updatedAt: "", // Auto-populated
});

// Validate with Zod
const validated = newsSchema.parse(newArticle);

// Get published news
const { items } = await getPublishedNews(10);

// Update an article
await newsRepository.update(newArticle.id, {
  excerpt: "VCM secures first place in the league",
  tags: ["victory", "championship", "league"],
});

// Query by slug
const article = await getNewsBySlug("vcm-wins-championship");

// Delete
await newsRepository.delete(newArticle.id);
```

## ✅ Phase 2 Progress - CMS Admin Interface

### CMS Entity Pages (7/8 Complete)

**✅ Completed Pages:**
1. **News** - Full CRUD with TipTap rich text editor, image upload, slug generation, status management
2. **Events** - Calendar view with visual date booking, conflict detection, location linking
3. **Teams** - Complete management with logo upload, trainer avatars, training schedule builder
4. **Members** - Avatar management, board member toggle, trainer toggle, role titles
5. **Sponsors** - Logo upload, tier management, website links
6. **Locations** - Full CRUD for event venues (name, address, description)
7. **Bus Bookings** - Calendar view with date range selection, conflict detection

**⏳ Pending:**
8. **Media Library** - Standalone media management UI (currently placeholder)

**CMS Features Implemented:**
- ✅ Image upload with S3 presigned URLs
- ✅ Form validation with Zod schemas
- ✅ Optimistic UI updates with TanStack Query
- ✅ Mantine UI components throughout
- ✅ Responsive design (mobile & desktop)
- ✅ Calendar visualizations for date conflicts
- ✅ File preview before upload
- ✅ Delete confirmations
- ✅ Loading states and error handling
- ✅ Notifications for success/error feedback

## 🔄 Next Steps (Phase 2 Remaining)

### 1. Complete Media Library UI
- Standalone media management page
- Grid view of all uploaded media
- Upload multiple files
- Edit metadata (title, alt text)
- Delete media (triggers S3 cleanup via Stream)

### 2. Deploy CMS to CloudFront
- Create CmsStack in CDK
- S3 bucket for static CMS build
- CloudFront distribution with OAC
- Custom domain: `dev-aws-migration-admin.new.vcmuellheim.de`
- Automatic Vite build and S3 upload via CDK

### 3. Data Migration Script
- Extract data from Payload Postgres
- Transform to DynamoDB format
- Batch write to all 8 tables
- Validation and reporting

## 🎯 Ready for Phase 3

With CMS nearly complete, next phase is:
- Frontend migration (Next.js → Vite + React SPA)
- Public API endpoints for frontend consumption
- SEO strategy (prerendering or Lambda@Edge)

## 📝 Design Decisions

1. **Multi-table design** - Simpler than single-table for small datasets (<100 items/table)
2. **Environment-based naming** - Table names include branch name for isolated environments
3. **On-demand billing** - Cost-effective for low-traffic dev environment
4. **Generic repository pattern** - Consistent CRUD operations across all entities
5. **Domain helpers** - Common queries pre-built for convenience
6. **Zod validation** - Runtime safety for data integrity
7. **DynamoDB Streams** - Prepared for S3 cleanup (implementation deferred)
9. **Manual DNS resources** - Shared hosted zone and certificates prevent accidental deletion and ensure stable nameservers
10. **Per-branch User Pools** - Complete environment isolation, allows stack destruction without losing production users
11. **Dynamic configuration** - CMS auto-discovers API endpoint and fetches Cognito config at runtime (zero-config deployments)
12. **Dual ACM certificates** - eu-central-1 for API Gateway (regional), us-east-1 for CloudFront (global service requirement)
13. **Git-based URL computation** - Shared utility ensures CDK and Vite use identical branch detection and sanitization logic
14. **Type attribute for News** - Generic `type: "article"` field enables GSI queries without special repository handling
15. **Repository type safety** - `create()` method accepts items without timestamps (added automatically)
