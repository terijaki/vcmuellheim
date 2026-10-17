/**
 * Programmatic CMS API — /api/admin/*
 * News routes authenticate with a bearer API key, not a browser session.
 */

import { handleAdminApiRequest } from "@webapp/server/functions/admin-news-api.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAdminApiRequest(request),
      POST: ({ request }) => handleAdminApiRequest(request),
    },
  },
});
