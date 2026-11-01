/**
 * Programmatic CMS API — bus bookings collection
 */

import { createBusApi, listBusApi } from "@webapp/server/functions/admin-cms-api-bus.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/bus")({
  server: {
    handlers: {
      GET: ({ request }) => listBusApi(request),
      POST: ({ request }) => createBusApi(request),
    },
  },
});
