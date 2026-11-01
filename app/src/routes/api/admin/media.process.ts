/**
 * Programmatic CMS API — process a news gallery image
 */

import { mediaProcessApi } from "@webapp/server/functions/admin-news-api.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/media/process")({
  server: {
    handlers: {
      POST: ({ request }) => mediaProcessApi(request),
    },
  },
});
