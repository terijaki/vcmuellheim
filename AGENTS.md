# Project Guidelines

This file provides instructions for AI coding agents working in this repository.
Subfolder-level `AGENTS.md` files contain additional context for specific areas of the codebase.

## Quick Overview

- **Monorepo** with Bun workspaces: `apps/cms`, `apps/website`, and `apps/shared`.
- **Frontend:** Vite + React (Mantine for UI, TanStack Router) — see [`apps/AGENTS.md`](apps/AGENTS.md).
- **Backend/Infra:** AWS CDK (in `lib/`, `bin/cdk.ts`) producing Lambdas, API Gateway, DynamoDB, S3 — see [`lib/AGENTS.md`](lib/AGENTS.md).
- **Server code / Lambdas:** under `lambda/` — see [`lambda/AGENTS.md`](lambda/AGENTS.md).
- **Shared runtime code:** `lib/trpc`, `lib/db`, `lib/*-stack.ts` (CDK stacks).

## Commands you will use often

- **Install deps:** `bun install` at repo root.
- **Run frontend locally:**
  - `bun run dev:website` — start website dev server.
  - `bun run dev:cms` — start CMS dev server.
- **Build:** `bun run build:website` or `bun run build:cms`.
- **Lint / format / typecheck:**
  - `bun run lint` (Biome lint)
  - `bun run typecheck` (tsc --noEmit)
  - `bun run check` / `bun run check:fix` (biome check)
- **Tests:** `bun run test` (or `bun test <path/to/test>` for a single file).
- **DB / scripts:** `bun run db:seed`
- **CDK:** `bun run cdk:deploy`, `bun run cdk:deploy {StackName}`, `bun run cdk:deploy:all` (scripts use AWS profile `vcmuellheim`).
- **jq:** when fetching data or using the AWS CLI, prefer including `jq`. e.g. `aws route53 list-hosted-zones ... | jq`

## Global codebase conventions

- **Formatting & linting:** Use Biome. Respect the existing `biome.json`/`bunfig.toml` configs.
- **Strings & style:** double quotes, semicolons, 2-space indentation.
- **Auth docs:** better-auth LLM documentation is available at https://better-auth.com/llms.txt.
- **Types:** prefer `import type` where applicable; keep `tsconfig.json` settings in mind when adding exports.
  - **CRITICAL:** Never cast as `unknown` or `any` — instead, find proper type-safe patterns using TypeScript's type system. For Zod schemas, use `z.infer<>` to derive proper types, use object spreading with conditional properties, or build updates incrementally with proper intermediate types.
- **Dates:** use `dayjs` (project-wide convention — do not introduce other date libraries).
- **Iteration patterns:** prefer `for...of` over `.forEach` in shared code.
- **Avoid adding new dependencies** without strong justification — prefer reusing packages listed in `package.json` catalog.

## What NOT to change / be cautious about

- Don't change project-wide Biome, Bun workspace, or CDK bootstrapping without coordinating — these affect CI and deployments.
- Avoid introducing new runtime dependencies lightly; prefer reusing packages listed in `package.json` catalog.

## When creating code suggestions

- Keep edits minimal and focused: follow existing file patterns (imports, export shapes, naming).
- Prefer small, reviewable PRs that change one area (frontend, lambda, or infra) at a time.
- When updating infra (`lib/*.ts`), include `cdk synth` output notes and required context (e.g., environment variables, AWS profile).
