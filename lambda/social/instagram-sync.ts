import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { EventBridgeEvent } from "aws-lambda";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { type InstagramPost, InstagramPostItemSchema, InstagramSyncLambdaEnvironmentSchema } from "./types";

const { tracer } = createLambdaResources("instagram-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(InstagramSyncLambdaEnvironmentSchema);
const TABLE_NAME = env.INSTAGRAM_TABLE_NAME;
const APIFY_API_KEY = env.APIFY_API_KEY;
const APIFY_SCHEDULE_ID = env.APIFY_SCHEDULE_ID;
const APIFY_ACTOR_ID = env.APIFY_ACTOR_ID;

// Hardcoded Instagram handles to scrape
const INSTAGRAM_HANDLES = ["vcmuellheim", "vcm_damen101"];

const lambdaHandler = async (event: EventBridgeEvent<string, unknown>) => {
	console.log("🚀 Starting Instagram sync job", { event });
	Sentry.addBreadcrumb({ category: "sync", message: "Starting Instagram sync", level: "info" });

	if (!TABLE_NAME) {
		throw new Error("INSTAGRAM_TABLE_NAME environment variable is not set");
	}

	if (!APIFY_API_KEY) {
		throw new Error("APIFY_API_KEY environment variable is not set");
	}

	if (!APIFY_SCHEDULE_ID) {
		throw new Error("APIFY_SCHEDULE_ID environment variable is not set");
	}

	if (!APIFY_ACTOR_ID) {
		throw new Error("APIFY_ACTOR_ID environment variable is not set");
	}

	try {
		// Step 1: Use hardcoded Instagram handles
		const handles = INSTAGRAM_HANDLES;
		console.log(`📋 Using ${handles.length} Instagram handles:`, handles);

		// Step 2: Update Apify schedule with current handles
		console.log("⚙️ Updating Apify schedule");
		await updateApifySchedule(handles);

		// Step 3: Fetch latest posts from Apify
		console.log("📸 Fetching Instagram posts from Apify");
		const posts = await fetchInstagramPosts();

		if (!posts || posts.length === 0) {
			console.log("⚠️ No Instagram posts found");
			return {
				statusCode: 200,
				body: JSON.stringify({ message: "No Instagram posts found" }),
			};
		}

		console.log(`✅ Found ${posts.length} Instagram posts`);
		Sentry.addBreadcrumb({ category: "sync", message: `Found ${posts.length} Instagram posts`, level: "info", data: { postsFound: posts.length } });
		Sentry.setMeasurement("instagram_sync.posts_found", posts.length, "none");

		// Step 4: Store posts in DynamoDB
		console.log("💾 Storing posts in DynamoDB");
		await storePosts(posts);

		console.log("✅ Instagram sync completed successfully");
		Sentry.setMeasurement("instagram_sync.handles_synced", handles.length, "none");
		Sentry.setMeasurement("instagram_sync.posts_stored", posts.length, "none");
		Sentry.addBreadcrumb({ category: "sync", message: "Instagram sync completed", level: "info", data: { handlesCount: handles.length, postsCount: posts.length } });

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Instagram sync completed",
				handlesCount: handles.length,
				postsCount: posts.length,
			}),
		};
	} catch (error) {
		console.error("❌ Error during Instagram sync:", error);
		Sentry.captureException(error);
		throw error;
	}
};

export const handler = Sentry.wrapHandler(lambdaHandler);

/**
 * Update Apify schedule with current Instagram handles
 */
async function updateApifySchedule(handles: string[]): Promise<void> {
	try {
		const response = await fetch(`https://api.apify.com/v2/schedules/${APIFY_SCHEDULE_ID}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${APIFY_API_KEY}`,
			},
			body: JSON.stringify({
				actions: [
					{
						type: "RUN_ACTOR",
						actorId: APIFY_ACTOR_ID,
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

		if (!response.ok) {
			throw new Error(`Failed to update Apify schedule: ${response.status} ${response.statusText}`);
		}

		console.log("✅ Apify schedule updated successfully");
	} catch (error) {
		console.error("Error updating Apify schedule:", error);
		throw error;
	}
}

/**
 * Fetch Instagram posts from Apify
 */
async function fetchInstagramPosts(): Promise<InstagramPost[]> {
	try {
		const response = await fetch("https://api.apify.com/v2/acts/apify~instagram-post-scraper/runs/last/dataset/items", {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${APIFY_API_KEY}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch Instagram posts: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();

		// Filter out errors and invalid posts
		const validPosts: InstagramPost[] = data.filter(
			(item: unknown) =>
				item &&
				typeof item === "object" &&
				"id" in item &&
				!("error" in item) && // Exclude error objects
				typeof item.id === "string",
		);

		return validPosts;
	} catch (error) {
		console.error("Error fetching Instagram posts:", error);
		throw error;
	}
}

/**
 * Store Instagram posts in DynamoDB
 */
async function storePosts(posts: InstagramPost[]): Promise<void> {
	const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days TTL
	const timestamp = new Date().toISOString();

	// Transform posts to DynamoDB items using Zod schema
	// This automatically: lowercases username, adds metadata, strips undefined values
	const items = posts.map((post) =>
		InstagramPostItemSchema.parse({
			...post,
			entityType: "POST" as const,
			updatedAt: timestamp,
			ttl,
		}),
	);

	// Batch write to DynamoDB (max 25 items per batch)
	const batches: (typeof items)[] = [];
	for (let i = 0; i < items.length; i += 25) {
		batches.push(items.slice(i, i + 25));
	}

	for (const batch of batches) {
		const command = new BatchWriteCommand({
			RequestItems: {
				[TABLE_NAME as string]: batch.map((item) => ({
					PutRequest: {
						Item: item,
					},
				})),
			},
		});

		await docClient.send(command);
	}

	console.log(`✅ Stored ${items.length} Instagram posts in DynamoDB`);
}
