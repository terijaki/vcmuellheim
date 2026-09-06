/**
 * Same-origin club logo proxy — /api/sams/logos?clubUuid=X
 *
 * Browsers load this path (cached by CloudFront) instead of the provider CDN URL.
 * The handler looks up the club in DynamoDB and streams `logoImageLink`.
 */

import { handleServeClubLogo } from "@webapp/server/functions/sams.server";
import { createFileRoute } from "@tanstack/react-router";

async function serveClubLogo(request: Request): Promise<Response> {
  const clubUuid = new URL(request.url).searchParams.get("clubUuid");
  if (!clubUuid) {
    return new Response("Missing clubUuid", {
      status: 400,
      headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=60" },
    });
  }
  return handleServeClubLogo(clubUuid);
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
