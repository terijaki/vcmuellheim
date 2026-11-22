/**
 * Programmatic CMS API — single volunteer event
 */

import {
  getVolunteerEventApi,
  updateVolunteerEventApi,
} from "@webapp/server/functions/admin-api/volunteer-events.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/volunteer-events/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => getVolunteerEventApi(request, params.id),
      PATCH: ({ request, params }) => updateVolunteerEventApi(request, params.id),
    },
  },
});
