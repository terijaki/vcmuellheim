import { z } from "zod";
import type { LeagueMatchDto, LeagueRankingsResourcePage, SeasonDto } from "@/data/sams/client";

// ============================================================================
// Club Schemas & Types
// ============================================================================

/**
 * Base club schema for DynamoDB
 */
const BaseClubItemSchema = z.object({
	sportsclubUuid: z.string(),
	name: z.string(),
	nameSlug: z.string(), // Used for case-insensitive queries
	associationUuid: z.string().optional(),
	associationName: z.string().optional(),
	logoImageLink: z.string().optional(),
	updatedAt: z.string(),
	ttl: z.number(), // DynamoDB TTL field
});

/**
 * Internal DynamoDB representation of a club
 * Automatically strips undefined values to save storage
 */
export const ClubItemSchema = BaseClubItemSchema.transform((data) => {
	// Remove undefined values to save DynamoDB storage
	return Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
});

export type ClubItem = z.infer<typeof ClubItemSchema>;

/**
 * Public API response for a club
 * Excludes internal fields (nameSlug, ttl)
 */
export const ClubResponseSchema = BaseClubItemSchema.omit({
	nameSlug: true,
	ttl: true,
});

export type ClubResponse = z.infer<typeof ClubResponseSchema>;

/**
 * Response for multiple clubs
 */
export const ClubsResponseSchema = z.object({
	clubs: z.array(ClubResponseSchema),
	count: z.number(),
});

export type ClubsResponse = z.infer<typeof ClubsResponseSchema>;

// ============================================================================
// Team Schemas & Types
// ============================================================================

/**
 * Base team schema for DynamoDB
 */
const BaseTeamItemSchema = z.object({
	uuid: z.string(),
	name: z.string(),
	nameSlug: z.string(), // Used for case-insensitive queries
	sportsclubUuid: z.string(),
	associationUuid: z.string(),
	leagueUuid: z.string(),
	leagueName: z.string(),
	seasonUuid: z.string(),
	seasonName: z.string(),
	updatedAt: z.string(),
	ttl: z.number(), // DynamoDB TTL field
});

/**
 * Internal DynamoDB representation of a team
 * Automatically strips undefined values to save storage
 */
export const TeamItemSchema = BaseTeamItemSchema.transform((data) => {
	// Remove undefined values to save DynamoDB storage
	return Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
});

export type TeamItem = z.infer<typeof TeamItemSchema>;

/**
 * Public API response for a team
 * Excludes internal fields (nameSlug, ttl)
 */
export const TeamResponseSchema = BaseTeamItemSchema.omit({
	nameSlug: true,
	ttl: true,
});

export type TeamResponse = z.infer<typeof TeamResponseSchema>;

/**
 * Response for multiple teams
 */
export const TeamsResponseSchema = z.object({
	teams: z.array(TeamResponseSchema),
});

export type TeamsResponse = z.infer<typeof TeamsResponseSchema>;

// ============================================================================
// Seasons Schemas & Types
// ============================================================================

/**
 * Response containing current, next, and previous seasons
 */
export const SeasonsResponseSchema = z.object({
	current: z.custom<SeasonDto[number]>(),
	next: z.custom<SeasonDto[number]>().optional(),
	previous: z.custom<SeasonDto[number]>().optional(),
});

export type SeasonsResponse = z.infer<typeof SeasonsResponseSchema>;

// ============================================================================
// Rankings Schemas & Types
// ============================================================================

/**
 * League rankings response
 */
export const RankingSchema = z.object({
	teams: z.custom<LeagueRankingsResourcePage["content"]>(),
	timestamp: z.date(),
	leagueUuid: z.string(),
	leagueName: z.string().nullish(),
	seasonName: z.string().nullish(),
});

export type Ranking = z.infer<typeof RankingSchema>;

// ============================================================================
// League Matches Schemas & Types
// ============================================================================

/**
 * League matches response (without HAL links)
 */
export const LeagueMatchesSchema = z.object({
	matches: z.custom<Omit<LeagueMatchDto, "_links">[]>(),
	timestamp: z.date(),
});

export type LeagueMatches = z.infer<typeof LeagueMatchesSchema>;

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
