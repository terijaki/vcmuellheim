"use cache";
"server-only";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { z } from "zod";
import { payload } from "@/data/payload-client";

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
export type InstagramPost = z.infer<typeof InstagramPostSchema>;

const InstagramErrorSchema = z.object({
	url: z.string().url(),
	requestErrorMessages: z.array(z.string()),
	error: z.string(),
	errorDescription: z.string(),
});

const InstagramResponseSchema = z.union([
	z.array(InstagramPostSchema), // either a valid post array
	z
		.array(InstagramErrorSchema)
		.transform(() => [] as InstagramPost[]), // or an error array that we transform to an empty array
]);

export async function getRecentInstagramPosts(): Promise<InstagramPost[] | null> {
	cacheLife("hours");
	try {
		if (!API_TOKEN) {
			console.warn("APIFY_API_KEY is not set in environment variables, skipping Instagram posts");
			return null;
		}

		if (process.env.NODE_ENV === "production") updateInstagamSchedule(); // Update the schedule to ensure we all team posts

		const request = await fetch("https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs/last/dataset/items", {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${API_TOKEN}`,
			},
		});
		if (request.status !== 200) {
			console.warn(`Failed to fetch data from Instagram API. Status: ${request.status}, ${request.statusText}`);
			return null;
		}

		const data = await request.json();
		const parsedData: InstagramPost[] = InstagramResponseSchema.parse(data);

		return parsedData;
	} catch (error) {
		console.error("Error fetching Instagram posts: ", error);
		return null;
	}
}

export async function updateInstagamSchedule() {
	try {
		if (!API_TOKEN) {
			console.warn("APIFY_API_KEY is not set in environment variables, skipping Instagram schedule update");
			return;
		}
		if (!scheduleId) {
			console.warn("APIFY Schedule ID is not set, skipping Instagram schedule update");
			return;
		}
		if (!scheduleActorID) {
			console.warn("APIFY Schedule Actor ID is not set, skipping Instagram schedule update");
			return;
		}

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
		if (!handles || handles.length === 0) {
			console.warn("No Instagram handles found, skipping Instagram schedule update");
			return;
		}

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
		if (request.status !== 200) {
			console.warn(`Failed to update schedule for Instagram API. Status: ${request.status}, ${request.statusText}`);
			return;
		}
	} catch (error) {
		console.error("Error updating Instagram schedule: ", error);
	}
}

export async function getInstagramPostByHandle(handle: string): Promise<InstagramPost[]> {
	cacheLife("hours");
	try {
		const allPosts = await getRecentInstagramPosts();

		if (!allPosts) {
			return [];
		}

		const filteredPosts = allPosts.filter((post) => post.ownerUsername.toLowerCase() === handle.toLowerCase());

		return filteredPosts;
	} catch (error) {
		console.error("Error fetching Instagram post by handle: ", error);
		return [];
	}
}
