/**
 * SAMS club logo proxy — replaces lambda/sams/sams-logo-proxy.ts
 * Fetches club logo URL from DynamoDB then proxies the image to the browser.
 * Uses long-lived cache headers since logos rarely change.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSamsClubByNameSlug, getSamsClubBySportsclubUuid } from "../../../server/db";

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

				let logoUrl: string | undefined;

				try {
					if (clubUuid) {
						const club = await getSamsClubBySportsclubUuid(clubUuid);
						logoUrl = club?.logoImageLink ?? undefined;
					} else if (clubSlug) {
						const club = await getSamsClubByNameSlug(clubSlug);
						logoUrl = club?.logoImageLink ?? undefined;
					}
				} catch (err) {
					console.error("Logo proxy: DB lookup failed", err);
					return new Response(JSON.stringify({ error: "Internal server error" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					});
				}

				if (!logoUrl) {
					return new Response(JSON.stringify({ message: "No logo available for this club" }), {
						status: 204,
						headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
					});
				}

				// Proxy the image from the upstream SAMS CDN
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000);

				let imageResponse: Response;
				try {
					imageResponse = await fetch(logoUrl, {
						signal: controller.signal,
						headers: { "User-Agent": "VCM Logo Proxy/1.0" },
					});
				} catch (err) {
					clearTimeout(timeoutId);
					console.error("Logo proxy: upstream fetch failed", err);
					return new Response(JSON.stringify({ error: "Failed to fetch logo from upstream" }), {
						status: 502,
						headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
					});
				}

				clearTimeout(timeoutId);

				if (!imageResponse.ok) {
					return new Response(JSON.stringify({ error: "Failed to fetch logo from upstream" }), {
						status: 502,
						headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
					});
				}

				const contentType = imageResponse.headers.get("content-type") || "image/png";
				const body = await imageResponse.arrayBuffer();
				const identifier = clubUuid || clubSlug!;

				return new Response(body, {
					status: 200,
					headers: {
						"Content-Type": contentType,
						"Cache-Control": `public, max-age=${CACHE_TTL}, immutable`,
						ETag: `"${identifier}-${body.byteLength}"`,
						"Access-Control-Allow-Origin": "*",
					},
				});
			},
		},
	},
});
