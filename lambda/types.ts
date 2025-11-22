import { z } from "zod";
import type { LeagueMatchDto, LeagueRankingsResourcePage, SeasonDto } from "@/data/sams/client";

// ============================================================================
// Club Schemas & Types
// ============================================================================

/**
 * Internal DynamoDB representation of a club
 * Includes fields used for querying and TTL
 */
export const ClubItemSchema = z.object({
	sportsclubUuid: z.string(),
	name: z.string(),
	nameSlug: z.string(), // Used for case-insensitive queries
	associationUuid: z.string().nullable().optional(),
	associationName: z.string().optional(),
	logoImageLink: z.string().nullable().optional(),
	updatedAt: z.string(),
	ttl: z.number(), // DynamoDB TTL field
});

export type ClubItem = z.infer<typeof ClubItemSchema>;

/**
 * Public API response for a club
 * Excludes internal fields (nameSlug, ttl)
 */
export const ClubResponseSchema = ClubItemSchema.omit({
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
 * Internal DynamoDB representation of a team
 * Includes fields used for querying and TTL
 */
export const TeamItemSchema = z.object({
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

export type TeamItem = z.infer<typeof TeamItemSchema>;

/**
 * Public API response for a team
 * Excludes internal fields (nameSlug, ttl)
 */
export const TeamResponseSchema = TeamItemSchema.omit({
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
	leagueName: z.string().nullable().optional(),
	seasonName: z.string().nullable().optional(),
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
