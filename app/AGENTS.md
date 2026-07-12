# Frontend Guidelines

This file provides instructions specific to `app/`, which is the unified TanStack Start application combining the website, admin, and server functions.

## Structure

- `app/src/` — Single unified app with public routes (/) and admin routes (/admin)
  - `app/src/routes/` — File-based TanStack Router routes
  - `app/src/components/` — Shared React components
  - `app/src/server/functions/` — Server functions (data fetching layer)
  - `app/src/lib/` — Shared utilities, hooks, config
  - `app/src/server/auth.ts` — Better-auth configuration

## Entrypoints

- Main app: `app/src/main.tsx`
- Routes: file-based in `app/src/routes/` (route tree auto-generated in `routeTree.gen.ts`)
- Server functions: `app/src/server/functions/`

## Frontend conventions

- **UI library:** Use Mantine components and theming throughout. (https://mantine.dev/llms.txt)
- **Routing:** TanStack Router — routes are file-based and the route tree is auto-generated (`routeTree.gen.ts`). Do not edit `routeTree.gen.ts` manually.
- **Styling:** PostCSS is configured via `postcss.config.cjs`. Global styles live in `app/src/index.css`.
- **Auth:** Better-auth OTP flow configured in `app/src/server/auth.ts`. Admin routes require session via `beforeLoad` guards.
- **Server functions (data fetching):** Use `createServerFn()` from TanStack React Start in `app/src/server/functions/`. Access them via React Query hooks in `app/src/hooks/dataQueries.ts`.

## Server function file layout

TanStack Start code is **isomorphic by default** — it is bundled for both server and client unless constrained. `createServerFn()` strips **handler bodies** from the client bundle, but **top-level imports in the same file are not**. Never put DynamoDB, S3, SES, SAMS API clients, or other Node-only deps in a file that client code imports.

Use this layout under `app/src/server/functions/` (see [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)):

| File                    | Purpose                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `feature.ts`            | `createServerFn` wrappers + Zod validators — **safe to import from routes, components, and hooks**           |
| `feature.server.ts`     | Server-only implementation (DB, AWS SDK, email, cache) — import **only** from `feature.ts` handlers or tests |
| `patch-helpers.ts` etc. | Pure/shared helpers with no server deps — no suffix needed                                                   |

Example:

```
app/src/server/functions/
├── events.ts          # export const getUpcomingEventsFn = createServerFn()…
├── events.server.ts   # export async function handleGetUpcomingEvents()…
```

Rules:

- **Static imports** of server functions from client code are correct — the build replaces them with RPC stubs.
- **Static imports** from `.server.ts` inside the wrapper file are correct — import protection keeps `.server.ts` out of client bundles.
- Do **not** use dynamic `import()` for server functions ([docs warn against it](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)).
- The `server/` directory name alone does **not** protect files — only the `*.server.*` suffix (or `import '@tanstack/react-start/server-only'`) does.
- Keep client-safe exports (types, Zod schemas) in the wrapper file when components need them (e.g. `PublicMember` in `members.ts`).
- Tests that target server-only logic import from `*.server.ts`; tests for RPC wiring import from the wrapper.
- **Images:** Image configuration is in `utils/image-config.ts`
