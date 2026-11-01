/**
 * Programmatic CMS API — volunteer event registrations (read-only)
 */

import { listVolunteerEventRegistrationsApi } from "@webapp/server/functions/admin-api/volunteer-events.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/volunteer-events/$id/registrations")({
  server: {
    handlers: {
      GET: ({ request, params }) => listVolunteerEventRegistrationsApi(request, params.id),
    },
  },
});
