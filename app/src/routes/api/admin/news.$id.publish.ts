/**
 * Programmatic CMS API — publish a news article
 */

import { publishNewsApi } from "@webapp/server/functions/admin-api/news.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/news/$id/publish")({
  server: {
    handlers: {
      POST: ({ request, params }) => publishNewsApi(request, params.id),
    },
  },
});
