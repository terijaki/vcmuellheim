"use cache";
"server-only";
import { payload } from "@/data/payload-client";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { z } from "zod";

const API_TOKEN = process.env.APIFY_API_KEY;
const scheduleId = "2QNPqeA1rum2087Xs"; // https://console.apify.com/schedules/2QNPqeA1rum2087Xs
const scheduleActorID = "nH2AHrwxeTRJoN5hX"; // https://console.apify.com/actors/nH2AHrwxeTRJoN5hX

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

		if (process.env.NODE_ENV === "production") updateInstagamSchedule(); // Update the schedule to ensure we all team posts

		const request = await fetch("https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs/last/dataset/items", {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${API_TOKEN}`,
			},
		});
		if (request.status !== 200) throw `Failed to fetch data from Instagram API. ${request.statusText}`;

		const data = await request.json();
		const parsedData: InstagramPost[] = InstagramPostsSchema.parse(data);

		return parsedData;
	} catch (error) {
		console.error("Error fetching Instagram posts: ", error);
		return [];
	}
}

export async function updateInstagamSchedule() {
	try {
		if (!API_TOKEN) throw "APIFY_API_KEY is not set in environment variables";
		if (!scheduleId) throw "APIFY Schedule ID is not set";
		if (!scheduleActorID) throw "APIFY Schedule Actor ID is not set";

		const teamData = await payload.find({
			collection: "teams",
			where: {
				instagram: {
					exists: true,
				},
			},
			select: {
				instagram: true,
			},
		});
		const teams = teamData?.docs || [];
		const handles: string[] = teams.filter((t) => t.instagram).map((t) => t.instagram?.toLowerCase() as string);
		if (!handles || handles.length === 0) throw "Instagram handle is required to update the schedule";

		const request = await fetch(`https://api.apify.com/v2/schedules/${scheduleId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${API_TOKEN}`,
			},
			body: JSON.stringify({
				actions: [
					{
						type: "RUN_ACTOR",
						actorId: scheduleActorID,
						runInput: {
							body: JSON.stringify({
								username: handles,
								onlyPostsNewerThan: "3 weeks",
								resultsLimit: 8,
								skipPinnedPosts: false,
							}),
							contentType: "application/json; charset=utf-8",
						},
					},
				],
			}),
		});
		if (request.status !== 200) throw `Failed to update schedule for Instagram API. ${request.statusText}`;

		const data = await request.json();
		console.log("💚", data, "💚");
	} catch (error) {
		console.error("Error fetching Instagram posts: ", error);
	}
}

export async function getInstagramPostByHandle(handle: string): Promise<InstagramPost[]> {
	cacheLife("hours");
	try {
		const allPosts = await getRecentInstagramPosts();

		const filteredPosts = allPosts.filter((post) => post.ownerUsername.toLowerCase() === handle.toLowerCase());

		return filteredPosts;
	} catch (error) {
		console.error("Error fetching Instagram post by handle: ", error);
		return [];
	}
}

