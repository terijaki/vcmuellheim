/**
 * Same-origin team logo proxy — /api/sams/team-logos?teamUuid=X
 *
 * Browsers load this path (cached by CloudFront) instead of the provider CDN URL.
 * The handler looks up the team in DynamoDB and streams the stored logo URL.
 */

import { handleServeTeamLogo } from "@webapp/server/functions/sams.server";
import { createFileRoute } from "@tanstack/react-router";

async function serveTeamLogo(request: Request): Promise<Response> {
  const teamUuid = new URL(request.url).searchParams.get("teamUuid");
  if (!teamUuid) {
    return new Response("Missing teamUuid", {
      status: 400,
      headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=60" },
    });
  }
  return handleServeTeamLogo(teamUuid);
}

export const Route = createFileRoute("/api/sams/team-logos")({
  server: {
    handlers: {
      GET: ({ request }) => serveTeamLogo(request),
      HEAD: async ({ request }) => {
        const response = await serveTeamLogo(request);
        return new Response(null, { status: response.status, headers: response.headers });
      },
    },
  },
});
