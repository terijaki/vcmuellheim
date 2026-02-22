# Infrastructure & Backend Guidelines

This file provides instructions specific to the `lib/` directory, which contains CDK stacks, the database layer, and tRPC routers.

## Structure

- `lib/*-stack.ts` — AWS CDK stack definitions (one file per stack)
- `lib/db/` — DynamoDB client, schemas, repositories, and types
- `lib/trpc/` — tRPC server setup, context, and routers
- `bin/cdk.ts` — CDK app entry point that instantiates all stacks

## Key files to reference

- CDK entry: `bin/cdk.ts`
- Stacks: `lib/sams-api-stack.ts`, `lib/website-stack.ts`, `lib/api-stack.ts`, `lib/social-media-stack.ts`, etc.
- DB client: `lib/db/client.ts`
- DB schemas: `lib/db/schemas.ts`
- DB repositories: `lib/db/repositories.ts`
- tRPC router index: `lib/trpc/index.ts`
- tRPC routers: `lib/trpc/routers/`

## CDK conventions

- Use the `vcmuellheim` AWS profile for all CDK CLI operations.
- Before deploying, always run `bun run cdk:synth` and `bun run cdk:diff` to verify changes.
- Deploy a single stack: `bun run cdk:deploy {StackName}`
- Deploy all stacks: `bun run cdk:deploy:all`
- Scheduled tasks use EventBridge constructs — see existing stacks for patterns.

## Integration points / external services

- **AWS:** CDK stacks create Lambdas, DynamoDB tables, S3 buckets, and Cognito resources. Use the `vcmuellheim` AWS profile.
- **SAMS API:** `codegen/sams/` contains the Swagger spec and client generation for the external SAMS sports data API used by sync Lambdas. Regenerate the client with `bun run sams:update`.
- **Background/schedulers:** EventBridge rules are defined in CDK constructs.

## DB conventions

- DynamoDB access goes through the repository pattern in `lib/db/repositories.ts`.
- Schemas are defined in `lib/db/schemas.ts` — update schemas and repositories together.
- Use `lib/db/types.ts` for shared DB-related types.

## tRPC conventions

- Add new procedures to the appropriate router under `lib/trpc/routers/`.
- Context setup is in `lib/trpc/context.ts`.
- The tRPC client config for frontends is in `apps/shared/lib/trpc-config.ts`.

## Testing

- Stack unit tests live alongside stack files (e.g., `lib/api-stack.test.ts`).
- Use `aws-sdk-client-mock` for AWS SDK calls in tests.
- Run tests: `bun run test`
