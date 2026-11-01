/**
 * Programmatic CMS API — news collection
 */

import { createNewsApi, listNewsApi } from "@webapp/server/functions/admin-api/news.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/news")({
  server: {
    handlers: {
      GET: ({ request }) => listNewsApi(request),
      POST: ({ request }) => createNewsApi(request),
    },
  },
});
