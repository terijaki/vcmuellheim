/**
 * Programmatic CMS API — single news article
 */

import {
  deleteNewsApi,
  getNewsApi,
  updateNewsApi,
} from "@webapp/server/functions/admin-news-api.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/news/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => getNewsApi(request, params.id),
      PATCH: ({ request, params }) => updateNewsApi(request, params.id),
      DELETE: ({ request, params }) => deleteNewsApi(request, params.id),
    },
  },
});
