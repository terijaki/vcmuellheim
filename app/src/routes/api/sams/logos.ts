/**
 * Same-origin club logo proxy — /api/sams/logos?clubUuid=X or ?clubSlug=Y
 *
 * Browsers load this path (cached by CloudFront) instead of the provider CDN URL.
 * The handler looks up the club in DynamoDB and streams `logoImageLink`.
 */

import { handleServeClubLogo } from "@webapp/server/functions/sams.server";
import { createFileRoute } from "@tanstack/react-router";

async function serveClubLogo(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const clubUuid = url.searchParams.get("clubUuid");
  const clubSlug = url.searchParams.get("clubSlug");
  if (clubUuid) return handleServeClubLogo({ clubUuid });
  if (clubSlug) return handleServeClubLogo({ clubSlug });
  return new Response("Missing clubUuid or clubSlug", {
    status: 400,
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=60" },
  });
}

export const Route = createFileRoute("/api/sams/logos")({
  server: {
    handlers: {
      GET: ({ request }) => serveClubLogo(request),
      HEAD: async ({ request }) => {
        const response = await serveClubLogo(request);
        return new Response(null, { status: response.status, headers: response.headers });
      },
    },
  },
});
