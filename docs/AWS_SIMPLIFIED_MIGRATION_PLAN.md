# AWS Simplified Migration Plan

**Goal:** Migrate from Next.js + Payload CMS on Coolify to a simplified, fully serverless AWS stack with custom CMS.

**Current State:**
- Next.js 15 app with Payload CMS (v3.54.0)
- Deployed via Coolify on VPS using Docker/Podman
- Postgres database for Payload
- S3 storage for media
- Some AWS CDK infrastructure already in place (SAMS API, Social Media lambdas)

**Target State:**
- **Frontend:** Vite + React SPA on S3 + CloudFront
- **Custom CMS:** React admin interface (separate SPA)
- **Data Layer:** DynamoDB for all content (news, events, teams, media metadata, etc.)
- **Media Storage:** S3 (already in use)
- **APIs:** Lambda + API Gateway
- **Jobs:** Lambda + EventBridge (already in place for SAMS sync)
- **CDN:** CloudFront

**Philosophy:** 
- Remove heavy frameworks (Next.js, Payload)
- Embrace AWS-native services
- Simple, maintainable, cost-effective
- Full control over data models and admin UI

**Timeline:** 4-8 weeks

---

## Phase 1: Data Model Design & DynamoDB Setup

**Duration:** 1-2 weeks

### Tasks:

1. [x] **Design DynamoDB Schema**
   - ✅ Map existing Payload collections to DynamoDB tables
   - ✅ Multi-table design (6 tables: News, Events, Teams, Members, Media, Sponsors)
   - ✅ Removed Users table (Cognito handles authentication)
   - ✅ Removed Roles table (role fields on Member entity)
   - ✅ Partition keys and sort keys determined
   - ✅ GSIs planned for common queries (publishedAt, slug, status, SAMS team mapping)

2. [x] **Create DynamoDB Tables via CDK**
   - ✅ Created ContentDbStack in lib/content-db-stack.ts
   - ✅ On-demand billing mode configured
   - ✅ Strategic GSIs set up (News: PublishedDate + Slug, Events: StartDate, Teams: Slug + Status + SamsTeam)
   - ✅ Point-in-Time Recovery (PITR) enabled
   - ✅ TTL configured on Sponsors table (expiryTimestamp)
   - ✅ Successfully deployed to AWS

3. [ ] **Migration Script**
   - Extract data from current Payload Postgres database
   - Transform to DynamoDB format
   - Batch write to new tables
   - Validate data integrity

4. [x] **Create Data Access Layer**
   - ✅ Zod v4 validation schemas (lib/db/schemas.ts)
   - ✅ TypeScript types inferred from Zod (lib/db/types.ts)
   - ✅ Generic Repository class with full CRUD (lib/db/repository.ts)
   - ✅ Repository instances for all 6 entities (lib/db/repositories.ts)
   - ✅ Domain-specific query helpers (getPublishedNews, getUpcomingEvents, etc.)
   - ✅ DynamoDB client configuration (lib/db/client.ts)

5. [ ] **Set up S3 Media Cleanup (DynamoDB Streams)**
   - ✅ Streams enabled on all tables (NEW_AND_OLD_IMAGES)
   - ⏳ Create Lambda function triggered on REMOVE events (deferred)
   - ⏳ Lambda deletes S3 object when media item deleted
   - ⏳ Lambda deletes logoId from Media when sponsor expires (TTL)
   - ⏳ Cascading: Sponsor TTL → Delete Media → Delete S3 object

6. [x] **Set up tRPC for Type-Safe APIs**
   - ✅ Installed tRPC dependencies (@trpc/server, @trpc/client, @trpc/react-query)
   - ✅ Created tRPC context with Cognito auth support (lib/trpc/context.ts)
   - ✅ Base procedures configured (publicProcedure, protectedProcedure)
   - ✅ All 6 entity routers created (news, events, teams, members, media, sponsors)
   - ✅ Lambda handler for API Gateway (lambda/trpc/handler.ts)
   - ✅ React client setup (lib/trpc/client.ts)
   - ✅ Complete documentation (docs/TRPC_SETUP.md)

---

## Phase 2: Custom CMS Admin Interface

**Duration:** 2-3 weeks

### Tasks:

1. [ ] **Vite + React Admin App Setup**
   - Create new Vite project (`admin/`)
   - Use TanStack Router for navigation
   - Use Mantine UI library (already in use for main site)
   - Set up authentication with AWS Cognito

2. [ ] **Authentication (AWS Cognito)**
   - Create Cognito User Pool via CDK
   - Free tier covers up to 50k MAUs (more than enough for <15 admins)
   - Pre-create admin user accounts
   - Integrate Cognito with React app (AWS Amplify UI or custom)
   - Lambda authorizer for API Gateway using Cognito JWT tokens
   - Implement login/logout flow
   - Protected routes in admin app

3. [ ] **Admin UI Pages**
   - Dashboard (overview, recent activity)
   - News management (list, create, edit, delete)
   - Events management
   - Teams management
   - Members management
   - Media library (upload to S3, manage metadata in DynamoDB)
   - Sponsors management
   - User management (admin accounts)

4. [ ] **CMS API (Lambda + API Gateway)**
   - CRUD endpoints for each entity
   - File upload endpoint (presigned S3 URLs or direct upload)
   - Image optimization/resizing (Lambda or S3 + CloudFront)
   - Authorization middleware (Cognito or custom)
   - Input validation

5. [ ] **Rich Text Editor**
   - Use **@mantine/tiptap** (official Mantine integration with Tiptap)
   - Perfect integration with Mantine theme system
   - Extensions: StarterKit, Image, Link, Table, CodeBlock
   - Image upload within editor (presigned S3 URLs)
   - Save as JSON (Tiptap's native format) in DynamoDB
   - Render on frontend using same Tiptap extensions (read-only mode)

6. [ ] **Deploy Admin App**
   - Build Vite app to static files
   - Upload to S3 bucket
   - Serve via CloudFront distribution
   - Optional: Custom domain for admin (e.g., admin.vcmuellheim.de)
   - SSL/TLS certificate via ACM

---

## Phase 3: Frontend Migration (Next.js → Vite + React)

**Duration:** 2-3 weeks

### Tasks:

1. [ ] **Create Vite + React App**
   - Initialize new Vite project (`frontend/` or convert existing `app/`)
   - Set up TanStack Router for client-side routing
   - Migrate existing components (already have many reusable ones)
   - Keep Mantine UI library

2. [ ] **Data Fetching**
   - Replace Next.js server components with client-side fetching
   - Use TanStack Query (React Query) for caching and state management
   - Create API client for Lambda/API Gateway endpoints
   - Consider ISR alternative: CloudFront cache with Lambda@Edge for dynamic data

3. [ ] **Routing Migration**
   - Map existing Next.js routes to React Router routes:
     - `/` → Home
     - `/news` → News list
     - `/news/[slug]` → News detail
     - `/teams` → Teams overview
     - `/termine` → Events
     - `/fotos` → Photo gallery
     - etc.

4. [ ] **Build & Optimization**
   - Code splitting with React.lazy
   - Image optimization (responsive images, WebP)
   - Bundle size optimization
   - Lighthouse performance audit

5. [ ] **SEO Considerations**
   - Since it's an SPA, implement:
     - React Helmet for meta tags
     - Prerendering for static pages (consider prerender.io or similar)
     - OR use Lambda@Edge for SSR critical pages (news detail, team pages)
     - Sitemap generation (Lambda job writes to S3)
     - robots.txt

6. [ ] **Deploy Frontend**
   - Build production bundle
   - Upload to S3 bucket
   - Configure CloudFront distribution
   - Set up cache behaviors (long cache for assets, short for HTML)
   - Custom domain (vcmuellheim.de)
   - SSL certificate via ACM

---

## Phase 4: API & Lambda Functions

**Duration:** 1-2 weeks

### Tasks:

1. [ ] **Public API Endpoints** (for frontend consumption)
   - `GET /api/news` - List news articles
   - `GET /api/news/:slug` - Get single article
   - `GET /api/events` - List events
   - `GET /api/teams` - List teams
   - `GET /api/members` - List members
   - `GET /api/sponsors` - List sponsors
   - `GET /api/photos` - List photo gallery
   - Consider pagination, filtering, sorting

2. [ ] **Existing Lambda Functions** (already done)
   - ✅ SAMS API integration
   - ✅ Social media scraping
   - Keep and optimize these

3. [ ] **New Lambda Functions**
   - Image resizing on upload (trigger from S3 or on-demand)
   - Sitemap generator (scheduled EventBridge job)
   - RSS feed generator
   - Email notifications (when new news posted)

4. [ ] **API Gateway Setup**
   - REST API or HTTP API (HTTP API is cheaper)
   - CORS configuration for frontend domains
   - Rate limiting and throttling
   - API key for admin endpoints (if not using Cognito)

5. [ ] **Caching Strategy**
   - CloudFront cache for API responses (e.g., 5-minute TTL)
   - DynamoDB query result caching (application level)
   - Invalidate cache on content updates

---

## Phase 5: Background Jobs & Scheduled Tasks

**Duration:** 1 week

### Tasks:

1. [ ] **Migrate Existing Jobs**
   - Already have EventBridge schedules for SAMS sync ✅
   - Ensure they work with new DynamoDB schema if needed

2. [ ] **New Scheduled Jobs**
   - Sitemap generation (daily or on content update)
   - Analytics aggregation (if needed)
   - Data cleanup/archiving (if needed)
   - Social media sync (if continuing Instagram integration)

3. [ ] **Job Monitoring**
   - CloudWatch Logs for all Lambda executions
   - CloudWatch Alarms for failures
   - SNS notifications on critical errors
   - Sentry integration (already using Sentry)

---

## Phase 6: DNS & Final Cutover

**Duration:** 1 week

### Tasks:

1. [ ] **DNS Configuration**
   - Point vcmuellheim.de to new CloudFront distribution
   - Point admin.vcmuellheim.de to admin CloudFront distribution
   - Set up ACM certificates for custom domains
   - Configure Route53 or existing DNS provider

2. [ ] **Parallel Running**
   - Run old VPS site and new AWS site simultaneously
   - Use different subdomains (e.g., beta.vcmuellheim.de)
   - Test thoroughly in production-like environment
   - User acceptance testing

3. [ ] **Gradual Rollout**
   - Option A: Blue/green deployment (instant cutover with rollback plan)
   - Option B: Gradual traffic shift via Route53 weighted routing
   - Monitor metrics closely (errors, latency, user behavior)

4. [ ] **Decommission Old Infrastructure**
   - Stop Coolify deployment
   - Shut down VPS after confidence period (1-2 weeks)
   - Archive old database backup
   - Cancel VPS subscription

---

## Phase 7: Monitoring & Optimization

**Duration:** Ongoing

### Tasks:

1. [ ] **CloudWatch Dashboards**
   - Lambda execution metrics (duration, errors, throttles)
   - API Gateway requests and latency
   - DynamoDB read/write capacity and throttling
   - CloudFront cache hit ratio
   - S3 storage and requests

2. [ ] **Cost Monitoring**
   - Set up AWS Cost Explorer
   - Create budget alerts
   - Tag resources properly for cost allocation
   - Optimize Lambda memory/timeout settings
   - Review DynamoDB capacity mode (on-demand vs provisioned)

3. [ ] **Performance Optimization**
   - Optimize Lambda cold starts (use Provisioned Concurrency if needed)
   - DynamoDB query optimization (use GSIs effectively)
   - CloudFront cache tuning
   - Image optimization and lazy loading
   - Bundle size reduction

4. [ ] **Security Hardening**
   - Review IAM policies (least privilege)
   - Enable AWS WAF on CloudFront (if needed for DDoS protection)
   - S3 bucket policies (prevent public access except via CloudFront)
   - Secrets rotation (Cognito, API keys, etc.)
   - Enable CloudTrail for audit logs

---

## Architecture Comparison

### Current Architecture (Coolify/VPS):
```
┌─────────────────┐
│   Next.js App   │
│  (Payload CMS)  │
├─────────────────┤
│   Postgres DB   │
├─────────────────┤
│  S3 (via AWS)   │
└─────────────────┘
      Docker/Podman
      on VPS
```

### Target Architecture (AWS Serverless):
```
┌──────────────────────────────────────────────┐
│              CloudFront (CDN)                │
├──────────────────┬───────────────────────────┤
│  Frontend SPA    │    Admin CMS SPA          │
│  (S3 bucket)     │    (S3 bucket)            │
└──────────────────┴───────────────────────────┘
                   │
         ┌─────────┴──────────┐
         │   API Gateway      │
         └─────────┬──────────┘
                   │
      ┌────────────┴─────────────┐
      │   Lambda Functions       │
      │  - Public API            │
      │  - Admin API             │
      │  - SAMS sync             │
      │  - Social media          │
      │  - Image processing      │
      └────────────┬─────────────┘
                   │
      ┌────────────┴─────────────┐
      │   DynamoDB Tables        │
      │  - News                  │
      │  - Events                │
      │  - Teams                 │
      │  - Members               │
      │  - Media                 │
      │  - Sponsors              │
      └──────────────────────────┘
                   │
      ┌────────────┴─────────────┐
      │      S3 Buckets          │
      │  - Media files           │
      │  - Frontend build        │
      │  - Admin build           │
      └──────────────────────────┘
```

---

## Migration Strategy & Rollback Plan

### Migration Approach:
1. **Build New Infrastructure in Parallel**
   - Don't touch existing VPS until new system is ready
   - Use separate AWS account or careful naming to avoid conflicts

2. **Data Migration**
   - One-time bulk migration from Postgres to DynamoDB
   - Option: Set up read-only API from old Payload during transition
   - Keep VPS running as fallback

3. **Testing**
   - Deploy to staging environment first (separate CloudFront + S3)
   - Full QA testing of all features
   - Performance testing
   - Load testing (if expecting traffic spikes)

4. **DNS Cutover**
   - Update DNS to point to CloudFront
   - Use low TTL initially (5 minutes) for quick rollback
   - Monitor for 24-48 hours
   - Increase TTL once stable

### Rollback Plan:
- Keep VPS running for 1-2 weeks after cutover
- If issues arise, point DNS back to VPS IP
- Data sync concerns: If users create content during AWS period, need manual migration back (unlikely for small club site)

---

## Cost Estimation

### Current Costs (Coolify/VPS):
- VPS hosting: €10-30/month
- Total: ~€10-30/month

### Estimated AWS Costs:
- **S3:** ~$1-5/month (storage + requests)
- **CloudFront:** ~$5-15/month (depends on traffic)
- **Lambda:** ~$1-5/month (generous free tier)
- **API Gateway:** ~$1-3/month (HTTP API is cheap)
- **DynamoDB:** ~$1-10/month (on-demand pricing, depends on usage)
- **Route53:** $0.50/month per hosted zone
- **ACM Certificates:** Free
- **Cognito:** Free tier (up to 50k MAUs)
- **CloudWatch:** ~$1-5/month (logs and metrics)

**Total Estimated:** ~$10-50/month depending on traffic

**Cost Optimization:**
- Use on-demand pricing for low/variable traffic
- Set up CloudFront cache aggressively to reduce origin requests
- Use S3 Intelligent Tiering for media files
- Review and delete unused resources regularly

---

## Success Metrics

- [ ] Zero downtime during migration
- [ ] No data loss
- [ ] Performance equal or better than current site (Lighthouse score)
- [ ] AWS costs within budget (≤ current VPS costs if possible)
- [ ] All features working (news, events, teams, photos, etc.)
- [ ] Admin CMS functional and easy to use
- [ ] Monitoring and alerting in place

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data migration errors | High | Thorough testing, validation scripts, keep VPS backup |
| Frontend performance degradation (SPA vs SSR) | Medium | Prerendering, CloudFront caching, Lambda@Edge for critical pages |
| Learning curve for DynamoDB | Medium | Start with simple schema, iterate, use single-table design patterns |
| AWS costs higher than expected | Medium | Cost alerts, monitoring, optimize early |
| Custom CMS bugs | Low | Thorough testing, start simple, add features incrementally |

---

## Next Steps (Immediate)

1. **Design DynamoDB schema** - Map out tables, keys, GSIs
2. **Create new CDK stack** for DynamoDB tables
3. **Build proof-of-concept** admin page (one entity, e.g., News)
4. **Test data migration** from Payload to DynamoDB
5. **Start building custom CMS admin UI** (basic CRUD for News)

---

## Notes

- **Advantages of this approach:**
  - Full control over data model and admin UI
  - Much simpler stack (no Next.js server, no Payload complexity, no Postgres)
  - True serverless (scales to zero, pay-per-use)
  - Easier to maintain long-term
  - Better cost efficiency for low/medium traffic
  
- **Trade-offs:**
  - Need to build custom admin UI (but more tailored to needs)
  - DynamoDB learning curve (but worth it for serverless)
  - SEO requires extra work for SPA (but solvable with prerendering or Lambda@Edge)

- **Why remove Payload:**
  - Payload is great but overkill for a small club website
  - Postgres requirement adds complexity and cost
  - Custom CMS can be simpler and exactly what you need
  
- **Why remove Next.js:**
  - Not using SSR, ISR, or server actions meaningfully
  - Vite + React is faster, simpler, and more flexible
  - Can always add Lambda@Edge SSR for specific pages if needed later
