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
import { parseServerData } from "../schema-parse";

const MAX_POSTS = 2;
const MAX_AGE_DAYS = process.env.NODE_ENV === "development" ? 365 : 14;
const BEHOLD_TIMEOUT_MS = 10_000;

export const getInstagramPostsFn = createServerFn({ method: "GET" }).handler(async (): Promise<BeholdPost[]> => {
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
		return feed.posts.filter((post) => dayjs(post.timestamp).isAfter(cutoff)).slice(0, MAX_POSTS);
	} catch (error) {
		Sentry.captureException(error);
		return [];
	}
});
