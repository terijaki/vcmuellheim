/**
 * Programmatic CMS API — volunteer events collection (read-only)
 */

import { listVolunteerEventsApi } from "@webapp/server/functions/admin-cms-api-volunteer-events.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/volunteer-events")({
  server: {
    handlers: {
      GET: ({ request }) => listVolunteerEventsApi(request),
    },
  },
});
