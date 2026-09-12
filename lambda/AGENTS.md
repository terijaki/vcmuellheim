# Lambda Guidelines

This file provides instructions specific to the `lambda/` directory, which contains the AWS Lambda function implementations.

## Structure

- `lambda/sams/` — SAMS provider event processor and shared read-path types
- `lambda/content/` — Lambdas for content management (image processing, S3 cleanup, sitemap)
- `lambda/social/` — Lambdas for social media integrations (Instagram, Mastodon)
- `lambda/utils/` — Shared Lambda utilities (e.g., Sentry error reporting)

## Key files to reference

- `lambda/sams/sams-provider-events.ts` — SQS consumer for `sams-provider` events (writes DynamoDB projections)
- `lambda/content/image-processor.ts` — invoke-only Bun.Image processor (`vcm-bun-image-processor-*`)
- `lambda/social/mastodon-share.ts` — social media Lambda example
- `lambda/social/behold-sync.ts` — scheduled Instagram feed cache writer

## Lambda conventions

- Each Lambda file exports a single handler function.
- Unit tests live alongside the Lambda file (e.g., `sams-provider-events.test.ts` next to `sams-provider-events.ts`).
- Use `aws-sdk-client-mock` in tests wherever AWS SDK calls are present.
- Use the Sentry utility (`lambda/utils/sentry.ts`) for error reporting.
- SAMS data comes from provider events (`sams-provider-events`). Do not call the SAMS REST API or import `sams-rest-v2`.

## Testing

- Run all Lambda tests: `vp test`
- Run a single test file: `vp test lambda/sams/sams-provider-events.test.ts`
- Mock AWS SDK calls with `aws-sdk-client-mock` (see existing tests for patterns).

## CDK wiring

Lambda functions are declared and wired up in the CDK stacks under `lib/` (e.g., `lib/sams-stack.ts`, `lib/social-media-stack.ts`). When adding a new Lambda, update the corresponding CDK stack as well.
