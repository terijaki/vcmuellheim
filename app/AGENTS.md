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
- **Server functions (data fetching):** Use `createServerFn()` from TanStack React Start in `app/src/server/functions/`. Access them via React Query hooks in `app/src/lib/hooks.ts`.
- **Images:** Image configuration is in `utils/image-config.ts`
