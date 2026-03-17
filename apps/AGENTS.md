# Frontend Guidelines

This file provides instructions specific to `apps/webapp/`, which is the unified TanStack Start application combining the website, admin, and server functions.

## Structure

- `apps/webapp/src/` — Single unified app with public routes (/) and admin routes (/admin)
  - `apps/webapp/src/routes/` — File-based TanStack Router routes
  - `apps/webapp/src/components/` — Shared React components
  - `apps/webapp/src/server/functions/` — Server functions (data fetching layer)
  - `apps/webapp/src/lib/` — Shared utilities, hooks, config
  - `apps/webapp/src/server/auth.ts` — Better-auth configuration

## Entrypoints

- Main app: `apps/webapp/src/main.tsx`
- Routes: file-based in `apps/webapp/src/routes/` (route tree auto-generated in `routeTree.gen.ts`)
- Server functions: `apps/webapp/src/server/functions/`

## Frontend conventions

- **UI library:** Use Mantine components and theming throughout.
- **Routing:** TanStack Router — routes are file-based and the route tree is auto-generated (`routeTree.gen.ts`). Do not edit `routeTree.gen.ts` manually.
- **Styling:** PostCSS is configured via `postcss.config.cjs`. Global styles live in `apps/webapp/src/index.css`.
- **Auth:** Better-auth OTP flow configured in `apps/webapp/src/server/auth.ts`. Admin routes require session via `beforeLoad` guards.
- **Server functions (data fetching):** Use `createServerFn()` from TanStack React Start in `apps/webapp/src/server/functions/`. Access them via React Query hooks in `apps/webapp/src/lib/hooks.ts`.
- **Images:** Image configuration is in `apps/shared/lib/image-config.ts` (shared library).
