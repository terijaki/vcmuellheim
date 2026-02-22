# Frontend Guidelines

This file provides instructions specific to the `apps/` directory, which contains the frontend applications.

## Structure

- `apps/website/` — Public-facing website (Vite + React)
- `apps/cms/` — Internal CMS (Vite + React)
- `apps/shared/lib/` — Shared components, utilities, and configuration used by both apps

## Entrypoints

- Website: `apps/website/src/main.tsx` and routes in `apps/website/src/routes/`
- CMS: `apps/cms/src/main.tsx` and routes in `apps/cms/src/routes/`
- Shared exports: `apps/shared/lib/index.ts`

## Frontend conventions

- **UI library:** Use Mantine components and theming throughout. Search `apps/*/src` for existing usage patterns before introducing new patterns.
- **Routing:** TanStack Router — routes are file-based and the route tree is auto-generated (`routeTree.gen.ts`). Do not edit `routeTree.gen.ts` manually.
- **Styling:** PostCSS is configured via `postcss.config.cjs`. Global styles live in `apps/website/src/globals.css`.
- **Auth:** CMS auth utilities are under `apps/cms/src/auth/`.
- **API calls:** Use the shared tRPC client (`apps/shared/lib/trpc-config.ts`) for all backend communication.
- **Images:** Use the shared image config (`apps/shared/lib/image-config.ts`) for consistent image handling.
