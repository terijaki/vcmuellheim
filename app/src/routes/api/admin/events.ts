/**
 * Programmatic CMS API — events collection (read-only)
 */

import { listEventsApi } from "@webapp/server/functions/admin-cms-api-events.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/events")({
  server: {
    handlers: {
      GET: ({ request }) => listEventsApi(request),
    },
  },
});
