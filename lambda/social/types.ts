import { z } from "zod";
import { optionalEnvString, requiredEnvString } from "../utils/env";

type SerializableValue = string | number | boolean | bigint | symbol | object;

const serializableValueSchema = z.custom<SerializableValue>((value) => value !== null && value !== undefined);

// ============================================================================
// Lambda Environment Contracts
// ============================================================================

export const InstagramSyncLambdaEnvironmentSchema = z.object({
	INSTAGRAM_TABLE_NAME: requiredEnvString,
	APIFY_API_KEY: requiredEnvString,
	APIFY_SCHEDULE_ID: requiredEnvString,
	APIFY_ACTOR_ID: requiredEnvString,
});

export type InstagramSyncLambdaEnvironment = z.infer<typeof InstagramSyncLambdaEnvironmentSchema>;

export const InstagramPostsLambdaEnvironmentSchema = z.object({
	INSTAGRAM_TABLE_NAME: requiredEnvString,
});

export type InstagramPostsLambdaEnvironment = z.infer<typeof InstagramPostsLambdaEnvironmentSchema>;

export const MastodonShareLambdaEnvironmentSchema = z.object({
	MASTODON_ACCESS_TOKEN: requiredEnvString,
	MEDIA_BUCKET_NAME: optionalEnvString,
	AWS_REGION: requiredEnvString,
});

export type MastodonShareLambdaEnvironment = z.infer<typeof MastodonShareLambdaEnvironmentSchema>;

export const MastodonStreamHandlerLambdaEnvironmentSchema = z.object({
	MASTODON_LAMBDA_NAME: requiredEnvString,
	ENVIRONMENT: requiredEnvString,
	WEBSITE_URL: requiredEnvString,
	NEWS_TABLE_NAME: requiredEnvString,
	AWS_REGION: requiredEnvString,
});

export type MastodonStreamHandlerLambdaEnvironment = z.infer<typeof MastodonStreamHandlerLambdaEnvironmentSchema>;

// ============================================================================
// Instagram Schemas & Types
// ============================================================================

/**
 * Instagram post from Apify scraper (input)
 */
export const InstagramPostSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	type: z.enum(["Image", "Video"]),
	url: z.string().optional(),
	ownerFullName: z.string(),
	ownerUsername: z.string(),
	inputUrl: z.string(),
	caption: z.string().optional(),
	displayUrl: z.string().optional(),
	videoUrl: z.string().optional(),
	dimensionsHeight: z.number(),
	dimensionsWidth: z.number(),
	images: z.array(z.record(z.string(), serializableValueSchema)).optional(),
	likesCount: z.number(),
	commentsCount: z.number(),
	hashtags: z.array(z.string()).optional(),
});

export type InstagramPost = z.infer<typeof InstagramPostSchema>;

/**
 * DynamoDB item schema - transforms Instagram post for storage
 * Automatically strips undefined/null values and adds metadata
 */
export const InstagramPostItemSchema = z
	.object({
		id: z.string(),
		entityType: z.literal("POST"),
		timestamp: z.string(),
		type: z.enum(["Image", "Video"]),
		ownerFullName: z.string(),
		ownerUsername: z.string().transform((val) => val.toLowerCase()),
		inputUrl: z.string(),
		dimensionsHeight: z.number(),
		dimensionsWidth: z.number(),
		likesCount: z.number(),
		commentsCount: z.number(),
		updatedAt: z.string(),
		ttl: z.number(),
		// Optional fields - only included if present
		url: z.string().optional(),
		caption: z.string().optional(),
		displayUrl: z.string().optional(),
		videoUrl: z.string().optional(),
		images: z.array(z.record(z.string(), serializableValueSchema)).optional(),
		hashtags: z.array(z.string()).optional(),
	})
	.transform((data) => {
		// Remove undefined values to save DynamoDB storage
		return Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined)) as InstagramPostItem;
	});

export type InstagramPostItem = {
	id: string;
	entityType: "POST";
	timestamp: string;
	type: "Image" | "Video";
	ownerFullName: string;
	ownerUsername: string;
	inputUrl: string;
	dimensionsHeight: number;
	dimensionsWidth: number;
	likesCount: number;
	commentsCount: number;
	updatedAt: string;
	ttl: number;
	url?: string;
	caption?: string;
	displayUrl?: string;
	videoUrl?: string;
	images?: Record<string, SerializableValue>[];
	hashtags?: string[];
};

/**
 * Response for multiple Instagram posts
 */
export interface InstagramPostsResponse {
	posts: InstagramPost[];
	count: number;
}
