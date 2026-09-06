import { z } from "zod";
import { samsProjectionMatchSchema, samsProjectionRankingEntrySchema } from "@/lib/db/schemas";
import { optionalEnvString, requiredEnvString } from "../utils/env";

export const SamsProviderProcessorLambdaEnvironmentSchema = z.object({
  CDK_ENVIRONMENT: optionalEnvString,
  SAMS_TABLE_NAME: requiredEnvString,
  SOCIAL_TABLE_NAME: optionalEnvString,
  MASTODON_LAMBDA_NAME: optionalEnvString,
});

export type SamsProviderProcessorLambdaEnvironment = z.infer<
  typeof SamsProviderProcessorLambdaEnvironmentSchema
>;

const RankingEntryResponseSchema = samsProjectionRankingEntrySchema.pick({
  uuid: true,
  teamName: true,
  rank: true,
  sportsclubUuid: true,
  logoUrl: true,
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

export type LeagueMatch = z.infer<typeof samsProjectionMatchSchema>;

export const LeagueMatchesResponseSchema = z.object({
  matches: z.array(samsProjectionMatchSchema),
  timestamp: z.iso.datetime(),
});

export type LeagueMatchesResponse = z.infer<typeof LeagueMatchesResponseSchema>;

const TickerSetSchema = z.object({
  setNumber: z.number(),
  setScore: z.object({
    team1: z.number(),
    team2: z.number(),
  }),
});

const TickerMatchStateSchema = z.object({
  started: z.boolean(),
  finished: z.boolean(),
  setPoints: z.object({
    team1: z.number(),
    team2: z.number(),
  }),
  matchSets: z.array(TickerSetSchema),
});

export const LiveMatchSchema = z.object({
  matchUuid: z.string(),
  team1Uuid: z.string(),
  team2Uuid: z.string(),
  team1Name: z.string(),
  team2Name: z.string(),
  state: TickerMatchStateSchema,
});

export type LiveMatch = z.infer<typeof LiveMatchSchema>;

export const LiveTickerResponseSchema = z.object({
  liveMatches: z.array(LiveMatchSchema),
  timestamp: z.iso.datetime(),
});

export type LiveTickerResponse = z.infer<typeof LiveTickerResponseSchema>;
