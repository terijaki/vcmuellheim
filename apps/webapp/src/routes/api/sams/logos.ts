/**
 * SAMS club logo endpoint — redirects to S3/CloudFront for clubs with cached logos,
 * falls back to proxying from the SAMS CDN for clubs that haven't been synced yet.
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

				let logoS3Key: string | undefined | null;
				let logoImageLink: string | undefined | null;

				try {
					if (clubUuid) {
						const club = await getSamsClubBySportsclubUuid(clubUuid);
						logoS3Key = club?.logoS3Key;
						logoImageLink = club?.logoImageLink;
					} else if (clubSlug) {
						const club = await getSamsClubByNameSlug(clubSlug);
						logoS3Key = club?.logoS3Key;
						logoImageLink = club?.logoImageLink;
					}
				} catch (err) {
					console.error("Logo lookup: DB lookup failed", err);
					return new Response(JSON.stringify({ error: "Internal server error" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}

				// Prefer S3-cached logo (fast, no rate-limit risk)
				if (logoS3Key) {
					const mediaCloudFrontUrl = process.env.CLOUDFRONT_URL ?? "";
					return new Response(null, {
						status: 302,
						headers: {
							Location: `${mediaCloudFrontUrl}/${logoS3Key}`,
							"Cache-Control": `public, max-age=${CACHE_TTL}`,
						},
					});
				}

				// Fallback: proxy from SAMS CDN for clubs not yet in S3
				if (logoImageLink) {
					let imageResponse: Response;
					try {
						imageResponse = await fetch(logoImageLink, {
							signal: AbortSignal.timeout(10_000),
							headers: { "User-Agent": "VCM Logo Proxy/1.0" },
						});
					} catch {
						return new Response(null, { status: 404 });
					}
					if (!imageResponse.ok) return new Response(null, { status: 404 });
					const contentType = imageResponse.headers.get("content-type") ?? "image/png";
					return new Response(imageResponse.body, {
						status: 200,
						headers: {
							"Content-Type": contentType,
							"Cache-Control": `public, max-age=${CACHE_TTL}`,
						},
					});
				}

				return new Response(JSON.stringify({ message: "No logo available for this club" }), {
					status: 404,
					headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
				});
			},
		},
	},
});
