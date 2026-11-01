/**
 * Programmatic CMS API — process a news gallery image
 */

import { mediaProcessApi } from "@webapp/server/functions/admin-api/news.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/media/process")({
  server: {
    handlers: {
      POST: ({ request }) => mediaProcessApi(request),
    },
  },
});
