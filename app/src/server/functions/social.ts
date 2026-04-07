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

export const getInstagramPostsFn = createServerFn({ method: "GET" }).handler(async (): Promise<BeholdPost[]> => {
	try {
		const response = await fetch(Instagram.beholdFeedUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch Behold feed: ${response.status}`);
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
