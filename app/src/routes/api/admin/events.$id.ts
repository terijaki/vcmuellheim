/**
 * Programmatic CMS API — single event (read-only)
 */

import { getEventApi } from "@webapp/server/functions/admin-cms-api-events.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/events/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => getEventApi(request, params.id),
    },
  },
});
