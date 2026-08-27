# Lambda Guidelines

This file provides instructions specific to the `lambda/` directory, which contains the AWS Lambda function implementations.

## Structure

- `lambda/sams/` — Lambdas that sync SAMS sports data (clubs sync, teams sync) and shared types
- `lambda/content/` — Lambdas for content management (ICS calendar, image processing, S3 cleanup, sitemap)
- `lambda/social/` — Lambdas for social media integrations (Instagram, Mastodon)
- `lambda/utils/` — Shared Lambda utilities (e.g., Sentry error reporting)

## Key files to reference

- `lambda/sams/sams-clubs-sync.ts` — clubs sync Lambda (scheduled + admin trigger)
- `lambda/sams/sams-teams-sync.ts` — teams sync Lambda (thin adapter over `lib/sams/teams-sync-service.ts`)
- `lambda/content/handler.ts` — content Lambda handler
- `lambda/social/mastodon-share.ts` — social media Lambda example
- Generated SAMS API client: [`sams-rest-v2`](https://www.npmjs.com/package/sams-rest-v2) via `utils/sams-client.ts` (do not call the API with raw `fetch`)

## Lambda conventions

- Each Lambda file exports a single handler function.
- Unit tests live alongside the Lambda file (e.g., `sams-clubs.test.ts` next to `sams-clubs-sync.ts`).
- Use `aws-sdk-client-mock` in tests wherever AWS SDK calls are present.
- Use the Sentry utility (`lambda/utils/sentry.ts`) for error reporting.
- The SAMS API client comes from the `sams-rest-v2` npm package — use `import { sams } from "@/utils/sams-client"`.

## Testing

- Run all Lambda tests: `vp test`
- Run a single test file: `vp test lambda/sams/sams-clubs.test.ts`
- Mock AWS SDK calls with `aws-sdk-client-mock` (see existing tests for patterns).

## CDK wiring

Lambda functions are declared and wired up in the CDK stacks under `lib/` (e.g., `lib/sams-api-stack.ts`, `lib/social-media-stack.ts`). When adding a new Lambda, update the corresponding CDK stack as well.
