import { zLeagueMatchDto, zLeagueRankingsEntryDto, zLocation, zSeasonDto, zVolleyballMatchResultsDto } from "@codegen/sams/generated/zod.gen";
import { z } from "zod";
import { requiredEnvString } from "../utils/env";

// ============================================================================
// Lambda Environment Contracts
// ============================================================================

export const SamsCommonLambdaEnvironmentSchema = z.object({
	SAMS_API_KEY: requiredEnvString,
	SAMS_SERVER: requiredEnvString,
});

export type SamsCommonLambdaEnvironment = z.infer<typeof SamsCommonLambdaEnvironmentSchema>;

export const SamsAssociationsLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema;
export const SamsSeasonsLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema;
export const SamsRankingsLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema;

export type SamsAssociationsLambdaEnvironment = z.infer<typeof SamsAssociationsLambdaEnvironmentSchema>;
export type SamsSeasonsLambdaEnvironment = z.infer<typeof SamsSeasonsLambdaEnvironmentSchema>;
export type SamsRankingsLambdaEnvironment = z.infer<typeof SamsRankingsLambdaEnvironmentSchema>;

export const SamsLeagueMatchesLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema.extend({
	CLUBS_TABLE_NAME: requiredEnvString,
});

export type SamsLeagueMatchesLambdaEnvironment = z.infer<typeof SamsLeagueMatchesLambdaEnvironmentSchema>;

export const SamsClubsSyncLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema.extend({
	CLUBS_TABLE_NAME: requiredEnvString,
});

export type SamsClubsSyncLambdaEnvironment = z.infer<typeof SamsClubsSyncLambdaEnvironmentSchema>;

export const SamsTeamsSyncLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema.extend({
	CLUBS_TABLE_NAME: requiredEnvString,
	TEAMS_TABLE_NAME: requiredEnvString,
});

export type SamsTeamsSyncLambdaEnvironment = z.infer<typeof SamsTeamsSyncLambdaEnvironmentSchema>;

export const SamsClubsLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema.extend({
	CLUBS_TABLE_NAME: requiredEnvString,
});

export type SamsClubsLambdaEnvironment = z.infer<typeof SamsClubsLambdaEnvironmentSchema>;

export const SamsTeamsLambdaEnvironmentSchema = SamsCommonLambdaEnvironmentSchema.extend({
	TEAMS_TABLE_NAME: requiredEnvString,
});

export type SamsTeamsLambdaEnvironment = z.infer<typeof SamsTeamsLambdaEnvironmentSchema>;

export const SamsLogoProxyLambdaEnvironmentSchema = z.object({
	CLUBS_TABLE_NAME: requiredEnvString,
});

export type SamsLogoProxyLambdaEnvironment = z.infer<typeof SamsLogoProxyLambdaEnvironmentSchema>;

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

/**
 * Query options for getting a club's logo
 */
export const ClubLogoQueryParamsSchema = z.union([z.object({ clubUuid: z.uuid(), clubSlug: z.undefined() }).strict(), z.object({ clubSlug: z.string().min(3), clubUuid: z.undefined() }).strict()]);

export type ClubLogoQueryParams = z.infer<typeof ClubLogoQueryParamsSchema>;

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
const RankingEntryResponseSchema = zLeagueRankingsEntryDto.pick({
	uuid: true,
	teamName: true,
	rank: true,
	matchesPlayed: true,
	points: true,
	wins: true,
	setWins: true,
	setLosses: true,
});

export const RankingResponseSchema = z.object({
	teams: z.optional(z.array(RankingEntryResponseSchema)),
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
 * Using generated schema - results field is properly typed as nullable
 */
const LeagueMatchTeamSchema = z.object({
	uuid: z.string(),
	name: z.string(),
	sportsclubUuid: z.string(),
});

const LeagueMatchEmbeddedSchema = z
	.object({
		team1: LeagueMatchTeamSchema.optional(),
		team2: LeagueMatchTeamSchema.optional(),
	})
	.nullish();

const LeagueMatchLocationSchema = zLocation
	.pick({
		uuid: true,
		name: true,
		longitude: true,
		latitude: true,
		address: true,
	})
	.nullish();

const LeagueMatchResponseItemSchema = zLeagueMatchDto
	.pick({
		uuid: true,
		date: true,
		time: true,
		matchNumber: true,
		host: true,
		leagueUuid: true,
		results: true,
		location: true,
		_embedded: true,
	})
	.extend({
		results: zVolleyballMatchResultsDto.nullish(),
		location: LeagueMatchLocationSchema,
		_embedded: LeagueMatchEmbeddedSchema,
	});

export const LeagueMatchesResponseSchema = z.object({
	matches: z.array(LeagueMatchResponseItemSchema),
	timestamp: z.iso.datetime(),
});

export type LeagueMatchesResponse = z.infer<typeof LeagueMatchesResponseSchema>;
