/**
 * Programmatic CMS API — single volunteer event (read-only)
 */

import { getVolunteerEventApi } from "@webapp/server/functions/admin-cms-api-volunteer-events.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/volunteer-events/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => getVolunteerEventApi(request, params.id),
    },
  },
});
