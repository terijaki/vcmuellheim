import { zLeagueMatchDto, zLeagueRankingsEntryDto, zSeasonDto } from "@codegen/sams/generated/zod.gen";
import { z } from "zod";

// ============================================================================
// Club Schemas & Types
// ============================================================================

/**
 * Base club schema for DynamoDB
 */
const BaseClubItemSchema = z.object({
	type: z.literal("club").default("club").describe("GSI partition key type"),
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
	type: z.literal("team").default("team").describe("GSI partition key type"),
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
	current: zSeasonDto,
	next: zSeasonDto.nullish(),
	previous: zSeasonDto.nullish(),
});

export type SeasonsResponse = z.infer<typeof SeasonsResponseSchema>;

// ============================================================================
// Rankings Schemas & Types
// ============================================================================

/**
 * League rankings response
 */
export const RankingResponseSchema = z.object({
	// reuse generated entry schema for ranking items
	teams: z.optional(z.array(zLeagueRankingsEntryDto)),
	timestamp: z.iso.datetime(),
	leagueUuid: z.string(),
	leagueName: z.string().nullish(),
	seasonName: z.string().nullish(),
});

export type RankingResponse = z.infer<typeof RankingResponseSchema>;

// ============================================================================
// League Matches Schemas & Types
// ============================================================================

/**
 * League matches response (without HAL links)
 */
export const LeagueMatchesResponseSchema = z.object({
	// use generated league match schema but remove _links for the public response
	matches: z.array(zLeagueMatchDto.omit({ _links: true })),
	timestamp: z.iso.datetime(),
});

export type LeagueMatchesResponse = z.infer<typeof LeagueMatchesResponseSchema>;
