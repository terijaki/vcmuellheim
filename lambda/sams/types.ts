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
	associationUuid: z.string().nullish(),
	associationName: z.string().nullish(),
	logoImageLink: z.string().nullish(),
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
	current: z.custom<SeasonDto>(),
	next: z.custom<SeasonDto>().nullish(),
	previous: z.custom<SeasonDto>().nullish(),
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
