/**
 * Programmatic CMS API — news gallery image upload URL
 */

import { mediaUploadUrlApi } from "@webapp/server/functions/admin-news-api.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/media/upload-url")({
  server: {
    handlers: {
      POST: ({ request }) => mediaUploadUrlApi(request),
    },
  },
});
