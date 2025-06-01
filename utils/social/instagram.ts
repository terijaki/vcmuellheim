"use cache";
"server-only";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { z } from "zod";

const API_TOKEN = process.env.APIFY_API_KEY;

const InstagramPostSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	type: z.enum(["Image", "Video"]),
	url: z.string().url(),
	ownerFullName: z.string(),
	ownerUsername: z.string(),
	inputUrl: z.string(),
	caption: z.string(),
	displayUrl: z.string().url(),
	videoUrl: z.string().url().optional(),
	dimensionsHeight: z.number(),
	dimensionsWidth: z.number(),
	images: z.array(z.unknown()).optional(),
	likesCount: z.number(),
	commentsCount: z.number(),
	hashtags: z.array(z.string()),
});
const InstagramPostsSchema = z.array(InstagramPostSchema);

export type InstagramPost = z.infer<typeof InstagramPostSchema>;

export async function getRecentInstagramPosts(): Promise<InstagramPost[]> {
	cacheLife("hours");

	try {
		if (!API_TOKEN) throw "APIFY_API_KEY is not set in environment variables";

		const requset = await fetch("https://api.apify.com/v2/acts/apify~instagram-scraper/runs/last/dataset/items", {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${API_TOKEN}`,
			},
		});
		if (requset.status !== 200) throw `Failed to fetch data from Instagram API. ${requset.statusText}`;

		const data = await requset.json();
		const parsedData: InstagramPost[] = InstagramPostsSchema.parse(data);

		return parsedData;
	} catch (error) {
		console.error("Error fetching Instagram posts: ", error);
		return [];
	}
}
