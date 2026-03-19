# Project Guidelines

This file provides instructions for AI coding agents working in this repository.
Subfolder-level `AGENTS.md` files contain additional context for specific areas of the codebase.

## Quick Overview

- **Unified monorepo** with Bun workspaces: `apps/webapp` (single TanStack Start app + Nitro backend).
- **Frontend & SSR:** TanStack Start with file-based routes, Mantine UI components — see [`apps/AGENTS.md`](apps/AGENTS.md).
- **Server functions:** Nitro-backed server functions under `apps/webapp/src/server/functions/`.
- **Backend/Infra:** AWS CDK (in `lib/`, `bin/cdk.ts`) producing WebApp Lambda, API Gateway, DynamoDB, S3 — see [`lib/AGENTS.md`](lib/AGENTS.md).
- **Background Lambdas:** Sync tasks, ICS/Sitemap/Social handlers under `lambda/` — see [`lambda/AGENTS.md`](lambda/AGENTS.md).
- **Shared runtime code:** `lib/db/` (repository layer), `lib/*-stack.ts` (CDK stacks), `lib/db/schemas.ts` (DB schemas).

## Commands you will use often

- **Install deps:** `bun install` at repo root.
- **Run webapp locally:**
  - `bun run dev` — start unified webapp dev server (includes website public routes + admin auth).
- **Build:** `bun run build`.
- **Lint / format / typecheck:**
  - `bun run lint` (Biome lint)
  - `bun run typecheck` (tsc --noEmit)
  - `bun run check` / `bun run check:fix` (biome check)
  - `bun run verify:all` (combined check + typecheck + tests)
- **Tests:** `bun run test` (or `bun test <path/to/test>` for a single file).
- **DB / scripts:** `bun run db:seed`, `bun run db:seed:sams`
- **CDK:** `bun run cdk:synth`, `bun run cdk:deploy`, `bun run cdk:deploy:all` (scripts use AWS profile `vcmuellheim`).
- **WebApp build prep:** `bun run build` (outputs `.output/` with Nitro server + static assets).

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
