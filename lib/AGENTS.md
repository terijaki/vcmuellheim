# Infrastructure & Backend Guidelines

This file provides instructions specific to the `lib/` directory, which contains AWS CDK stacks and the database layer.

## Structure

- `lib/*-stack.ts` — AWS CDK stack definitions (one file per stack):
  - `lib/webapp-stack.ts` — Unified TanStack Start webapp (Nitro Lambda, CloudFront, S3)
  - `lib/content-db-stack.ts` — DynamoDB tables for content (news, events, teams, members, sponsors, bus, locations, users, auth)
  - `lib/sams-api-stack.ts` — SAMS API proxy (Lambda + API Gateway + Lambda@Edge)
  - `lib/social-media-stack.ts` — Instagram & Mastodon integration Lambdas + DynamoDB
  - `lib/media-stack.ts` — S3 bucket + CloudFront distribution for media assets
  - `lib/dns-stack.ts` — Route53 hosted zones and DNS records
  - `lib/monitoring-stack.ts` — CloudWatch dashboards, alarms, SNS topics
  - `lib/budget-stack.ts` — AWS Billing and cost alerts
- `lib/db/` — DynamoDB client, schemas, repositories, and types
- `bin/cdk.ts` — CDK app entry point that instantiates all stacks

## Key files to reference

- CDK entry: `bin/cdk.ts`
- Active stacks: `lib/webapp-stack.ts`, `lib/content-db-stack.ts`, `lib/sams-api-stack.ts`, `lib/social-media-stack.ts`, `lib/media-stack.ts`, `lib/dns-stack.ts`, `lib/monitoring-stack.ts`, `lib/budget-stack.ts`
- DB client: `lib/db/client.ts` (DynamoDB DocumentClient with X-Ray tracing)
- DB schemas: `lib/db/schemas.ts` (Zod schemas for all entities)
- DB repositories: `lib/db/repositories.ts` (repository pattern for CRUD + queries)
- DB types: `lib/db/types.ts` (derived types from schemas)

## CDK conventions

- Use the `vcmuellheim` AWS profile for all CDK CLI operations.
- Before deploying, always run `vp run cdk:synth` and `vp run cdk:diff` to verify changes.
- Deploy a single stack: `vp run cdk:deploy {StackName}`
- Deploy all stacks: `vp run cdk:deploy:all`
- Scheduled tasks use EventBridge constructs — see existing stacks for patterns.

## Integration points / external services

- **AWS:** CDK stacks create Lambdas, DynamoDB tables, S3 buckets, and Cognito resources. Use the `vcmuellheim` AWS profile.
- **SAMS API:** `codegen/sams/` contains the Swagger spec and client generation for the external SAMS sports data API used by sync Lambdas. Regenerate the client with `vp run sams:update`.
- **Background/schedulers:** EventBridge rules are defined in CDK constructs.

## DB conventions

- DynamoDB access goes through the repository pattern in `lib/db/repositories.ts`.
- Schemas are defined in `lib/db/schemas.ts` — update schemas and repositories together.
- Use `lib/db/types.ts` for shared DB-related types.

## Server functions (replacing tRPC)

The webapp uses **TanStack React Start server functions** instead of tRPC. All data fetching is server-side rendered in `apps/webapp/src/server/functions/`:

- Each server function is a `createServerFn()` with optional middleware (`requireAuthMiddleware`) and input validators (Zod).
- Results are used via React Query hooks under `apps/webapp/src/lib/hooks.ts`.
- This approach eliminates the need for a separate tRPC API layer.

## Testing

- Stack unit tests live alongside stack files (e.g., `lib/sams-api-stack.test.ts`).
- Use `aws-sdk-client-mock` for AWS SDK calls in tests.
- Run tests: `vp test`
