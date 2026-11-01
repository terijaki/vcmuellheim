/**
 * Programmatic CMS API — OpenAPI document
 */

import { getAdminCmsOpenApiResponse } from "@webapp/server/functions/admin-api/openapi.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/openapi.json")({
  server: {
    handlers: {
      GET: ({ request }) => getAdminCmsOpenApiResponse(request),
    },
  },
});
