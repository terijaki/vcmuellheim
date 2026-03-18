/**
 * SAMS club logo redirect — serves logos cached in S3 by the clubs sync Lambda.
 * Returns a 302 redirect to the media CloudFront URL for the club's S3 logo key.
 */

import { createFileRoute } from "@tanstack/react-router";
import { getSamsClubByNameSlug, getSamsClubBySportsclubUuid } from "@webapp/server/queries";
import { z } from "zod";

const CACHE_TTL = 90 * 24 * 60 * 60; // 90 days in seconds

const QuerySchema = z.union([z.object({ clubUuid: z.string().min(1), clubSlug: z.undefined().optional() }), z.object({ clubSlug: z.string().min(1), clubUuid: z.undefined().optional() })]);

export const Route = createFileRoute("/api/sams/logos")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url);
				const clubUuid = url.searchParams.get("clubUuid") ?? undefined;
				const clubSlug = url.searchParams.get("clubSlug") ?? undefined;

				const parsed = QuerySchema.safeParse({ clubUuid, clubSlug });
				if (!parsed.success) {
					return new Response(JSON.stringify({ error: "Either 'clubUuid' or 'clubSlug' query parameter is required" }), {
						status: 400,
						headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
					});
				}

				let logoS3Key: string | undefined;

				try {
					if (clubUuid) {
						const club = await getSamsClubBySportsclubUuid(clubUuid);
						logoS3Key = club?.logoS3Key ?? undefined;
					} else if (clubSlug) {
						const club = await getSamsClubByNameSlug(clubSlug);
						logoS3Key = club?.logoS3Key ?? undefined;
					}
				} catch (err) {
					console.error("Logo redirect: DB lookup failed", err);
					return new Response(JSON.stringify({ error: "Internal server error" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!logoS3Key) {
					return new Response(JSON.stringify({ message: "No logo available for this club" }), {
						status: 404,
						headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
					});
				}

				const mediaCloudFrontUrl = process.env.CLOUDFRONT_URL ?? "";
				const logoUrl = `${mediaCloudFrontUrl}/${logoS3Key}`;

				return new Response(null, {
					status: 302,
					headers: {
						Location: logoUrl,
						"Cache-Control": `public, max-age=${CACHE_TTL}`,
					},
				});
			},
		},
	},
});
