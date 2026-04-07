/**
 * Social media server functions — fetches Instagram posts from Behold.so CDN feed.
 * Public, no auth required.
 */

import * as Sentry from "@sentry/tanstackstart-react";
import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import type { BeholdPost } from "@/lambda/social/types";
import { BeholdFeedSchema } from "@/lambda/social/types";
import { Instagram } from "@project.config";
import { createCacheKey } from "@utils/cache";
import { readSamsCacheEntry, writeSamsCacheEntry } from "../sams-ddb-cache";
import { parseServerData } from "../schema-parse";

const MAX_POSTS = 2;
const MAX_AGE_DAYS = process.env.NODE_ENV === "development" ? 365 : 14;
const BEHOLD_TIMEOUT_MS = 10_000;

/**
 * 6-hour cache TTL for Behold feed responses.
 * Keeps API views well within Behold's 1200/month free-tier limit:
 * at most 4 fetches/day × 30 days = ~120 views/month.
 */
const BEHOLD_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BEHOLD_CACHE_KEY = createCacheKey({ type: "behold_feed" });

export const getInstagramPostsFn = createServerFn({ method: "GET" }).handler(async (): Promise<BeholdPost[]> => {
	// Check DDB cache first to avoid consuming Behold's monthly view quota
	try {
		const cached = await readSamsCacheEntry<BeholdPost[]>(BEHOLD_CACHE_KEY, BEHOLD_CACHE_TTL_MS);
		if (cached) return cached;
	} catch {
		// DDB unavailable — fall through to live fetch
	}

	try {
		const response = await fetch(Instagram.beholdFeedUrl, { signal: AbortSignal.timeout(BEHOLD_TIMEOUT_MS) });
		if (!response.ok) {
			// Expected/quota errors (e.g. 403 monthly limit) — log as message to avoid Sentry noise
			Sentry.captureMessage(`Behold feed returned ${response.status}`, "warning");
			return [];
		}

		const raw: unknown = await response.json();
		const feed = parseServerData(BeholdFeedSchema, raw, "Failed to parse Behold feed");

		const cutoff = dayjs().subtract(MAX_AGE_DAYS, "day");
		const posts = feed.posts.filter((post) => dayjs(post.timestamp).isAfter(cutoff)).slice(0, MAX_POSTS);

		// Write to DDB cache; if write fails, posts are still returned successfully
		writeSamsCacheEntry(BEHOLD_CACHE_KEY, posts).catch((error) => {
			Sentry.captureException(error, { extra: { cacheKey: BEHOLD_CACHE_KEY, postCount: posts.length } });
		});

		return posts;
	} catch (error) {
		Sentry.captureException(error);
		return [];
	}
});
