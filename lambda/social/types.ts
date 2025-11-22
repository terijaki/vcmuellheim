import { z } from "zod";

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
	images: z.array(z.unknown()).optional(),
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
		images: z.array(z.unknown()).optional(),
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
	images?: unknown[];
	hashtags?: string[];
};

/**
 * Response for multiple Instagram posts
 */
export interface InstagramPostsResponse {
	posts: InstagramPost[];
	count: number;
}
