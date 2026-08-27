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
  - `lib/monitoring-stack.ts` — CloudWatch alarms and SNS topics (prod + shared-dev only)
  - `lib/budget-stack.ts` — AWS Billing and cost alerts (prod + shared-dev only)
- `lib/db/` — DynamoDB client, schemas, repositories, and types
- `bin/cdk.ts` — CDK app entry point that instantiates all stacks

## Key files to reference

- CDK entry: `bin/cdk.ts`
- Account-baseline stacks: `BudgetStack` and `MonitoringStack` deploy for **prod** and **shared dev** (`main` / empty sanitized branch) only — not on feature-branch deploys. See `shouldDeployAccountOpsStacks` in `utils/cdk-deploy.ts`.
- Active stacks: `lib/webapp-stack.ts`, `lib/content-db-stack.ts`, `lib/sams-api-stack.ts`, `lib/social-media-stack.ts`, `lib/media-stack.ts`, `lib/dns-stack.ts`, `lib/monitoring-stack.ts`, `lib/budget-stack.ts`
- DB client: `lib/db/client.ts` (DynamoDB DocumentClient with X-Ray tracing)
- DB schemas: `lib/db/schemas.ts` (Zod schemas for all entities)
- DB repositories: `lib/db/repositories.ts` (repository pattern for CRUD + queries)
- DB types: `lib/db/types.ts` (derived types from schemas)

## CDK conventions

- Use AWS SSO for authentication. Authenticate with your configured SSO session and export credentials for the appropriate profile before running CDK commands — see `docs/SETUP.md` for setup instructions.
- Dev CDK commands use the `vcm-dev` profile; prod commands use the `vcm-prod` profile.
- Before deploying, always run `vpr cdk:synth` and `vpr cdk:diff` to verify changes.
- Deploy a single stack: `vpr cdk:deploy {StackName}`
- Deploy all stacks: `vpr cdk:deploy:all`
- Scheduled tasks use EventBridge constructs — see existing stacks for patterns.

## Integration points / external services

- **AWS:** CDK stacks create Lambdas, DynamoDB tables, S3 buckets, and Cognito resources. Use the `vcm-dev` profile for dev and `vcm-prod` for prod.
- **SAMS API:** Use the [`sams-rest-v2`](https://www.npmjs.com/package/sams-rest-v2) npm package via `import { sams } from "@/utils/sams-client"`. Bump the dependency when the upstream SAMS spec or bug workarounds change.
- **Background/schedulers:** EventBridge rules are defined in CDK constructs.

## DB conventions

- DynamoDB access goes through the repository pattern in `lib/db/repositories.ts`.
- Schemas are defined in `lib/db/schemas.ts` — update schemas and repositories together.
- Use `lib/db/types.ts` for shared DB-related types.

## Server functions (replacing tRPC)

The webapp uses **TanStack React Start server functions** instead of tRPC. All data fetching is server-side rendered in `app/src/server/functions/`:

- Each server function is a `createServerFn()` with optional middleware (`requireAuthMiddleware`) and input validators (Zod).
- Results are used via React Query hooks under `app/src/hooks/dataQueries.ts`.
- Server-only logic (DynamoDB, AWS SDK, etc.) belongs in `*.server.ts` files — see `app/AGENTS.md` for the full file-layout convention.
- This approach eliminates the need for a separate tRPC API layer.

## Testing

- Stack unit tests live alongside stack files (e.g., `lib/sams-api-stack.test.ts`).
- Use `aws-sdk-client-mock` for AWS SDK calls in tests.
- Run tests: `vp test`
