# Project Guidelines for GitHub Copilot

This file tells AI coding agents how this repository is structured, which conventions to follow, and which commands and entry points are important for local development and deployment.

## Quick Overview

- **Monorepo** with Bun workspaces: `apps/cms`, `apps/website`, and `apps/shared`.
- **Frontend:** Vite + React (Mantine for UI, TanStack Router).
- **Backend/Infra:** AWS CDK (in `lib/`, `bin/cdk.ts`) producing Lambdas, API Gateway, DynamoDB, S3.
- **Server code / Lambdas:** under `lambda/` (e.g. `lambda/sams/*`, `lambda/content/*`).
- **Shared runtime code:** `lib/trpc`, `lib/db`, `lib/*-stack.ts` (CDK stacks).

## Commands you will use often

- **Install deps:** `bun install` at repo root.
- **Run frontend locally:**
	- `bun run dev:website` — start website dev server (workspace filter used).
	- `bun run dev:cms` — start CMS dev server.
- **Build:** `bun run build:website` or `bun run build:cms`.
- **Lint / format / typecheck:**
	- `bun run lint` (Biome lint)
	- `bun run typecheck` (tsc --noEmit)
	- `bun run check` / `bun run check:fix` (biome check)
- **Tests:** `bun run test` (or `bun test <path/to/test>` for a single file).
- **DB / scripts:** `bun run db:seed`
- **CDK:** `bun run cdk:deploy`, `bun run cdk:deploy {StackName}` `bun run cdk:deploy:all` (scripts use AWS profile `vcmuellheim`).

## Codebase conventions (follow these precisely)

- **Formatting & linting:** Use Biome. Respect the existing `biome.json`/`bunfig.toml` configs.
- **Strings & style:** double quotes, semicolons, 2 spaces indentation.
- **Types:** prefer `import type` where applicable; keep `tsconfig.json` settings in mind when adding exports.
  - **CRITICAL:** Never cast as `unknown` or `any` — instead, find proper type-safe patterns using TypeScript's type system. For Zod schemas, use `z.infer<>` to derive proper types, use object spreading with conditional properties, or build updates incrementally with proper intermediate types.
- **Dates:** use `dayjs` (project-wide convention — do not introduce other date libraries).
- **UI:** prefer Mantine components and theming (search `apps/*/src` for examples).
- **Iteration patterns:** prefer `for...of` over `.forEach` in shared code.
- **Avoid adding new dependencies** without strong justification — prefer reusing packages listed in `package.json` catalog.

## Important files and patterns to reference (examples)

- CDK entry: `bin/cdk.ts` and stacks in `lib/*.ts` (e.g. `sams-api-stack.ts`, `website-stack.ts`).
- DB client and schemas: `lib/db/client.ts`, `lib/db/schemas.ts`.
- TRPC: `lib/trpc/*` and the TRPC routers under `lib/trpc/routers`.
- Frontend entrypoints: `apps/website/src/main.tsx`, `apps/cms/src/main.tsx`, and `apps/shared/lib` for shared components.
- Lambda implementations: `lambda/` (e.g. `lambda/sams/sams-clubs.ts`, `lambda/content/handler.ts`). Unit tests for lambdas live alongside them (e.g. `lambda/sams/sams-clubs.test.ts`).
- Code generation & API clients: `codegen/sams/` (Swagger-based client generation).

## Integration points / external services

- AWS: CDK-managed stacks create Lambdas, DynamoDB tables, S3 buckets, Cognito integration. Use the `vcmuellheim` AWS profile in CDK scripts.
- External APIs: `codegen/sams` contains Swagger & client generation for the SAMS API used by sync lambdas. (see `sams:update` in `package.json` scripts).
- Background/schedulers: EventBridge via CDK constructs.

## Testing and debugging notes

- Unit tests: run with `bun test`. Target single-file tests with `bun test lambda/sams/sams-clubs.test.ts`.
- Use `aws-sdk-client-mock` in tests where AWS SDK calls are present (see existing tests under `lib/` and `lambda/`).
- For CDK debugging, use `bun run cdk:synth` and `bun run cdk:diff` before `deploy` to verify changes.

## What NOT to change / be cautious about

- Don't change project-wide Biome, Bun workspace, or CDK bootstrapping without coordinating — these affect CI and deployments.
- Avoid introducing new runtime dependencies lightly; prefer reusing packages listed in `package.json` catalog.

## When creating code suggestions

- Keep edits minimal and focused: follow existing file patterns (imports, export shapes, naming).
- Prefer small, reviewable PRs that change one area (frontend, lambda, or infra) at a time.
- When updating infra (`lib/*.ts`), include `cdk synth` output notes and required context (e.g., environment variables, AWS profile).
