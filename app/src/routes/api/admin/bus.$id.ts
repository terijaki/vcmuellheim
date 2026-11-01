/**
 * Programmatic CMS API — single bus booking
 */

import {
  deleteBusApi,
  getBusApi,
  updateBusApi,
} from "@webapp/server/functions/admin-api/bus.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/bus/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => getBusApi(request, params.id),
      PATCH: ({ request, params }) => updateBusApi(request, params.id),
      DELETE: ({ request, params }) => deleteBusApi(request, params.id),
    },
  },
});
