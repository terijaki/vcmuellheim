/**
 * SAMS server functions for read paths backed by DynamoDB projections.
 *
 * Server-only logic lives in `sams.server.ts`
 * (import-protected). This file exports createServerFn wrappers safe for client code.
 */

import { createServerFn } from "@tanstack/react-start";
import { samsMatchesInputSchema } from "@utils/sams-matches";
import { z } from "zod";
import {
  handleGetSamsMatches,
  handleGetSamsProjectionFreshness,
  handleGetSamsRankingByLeagueUuid,
  handleGetSamsRankingsByLeagueUuids,
  handleGetSamsRosterByTeamUuid,
  handleGetSamsTicker,
  handleListSamsClubs,
  handleListSamsTeams,
  handleLoadSamsMatchesForSsr,
  handlePeekSamsRankingsCache,
  handleReadSamsMatchesCache,
} from "./sams.server";

export type { SamsMatchesInput } from "@utils/sams-matches";
export type { SamsMatchesHookOptions } from "@webapp/utils/sams-ssr";

export const getSamsMatchesFn = createServerFn()
  .validator(samsMatchesInputSchema)
  .handler(async ({ data }) => handleGetSamsMatches(data));

export const getSamsRankingsByLeagueUuidsFn = createServerFn()
  .validator(z.object({ leagueUuids: z.array(z.string()) }))
  .handler(async ({ data }) => handleGetSamsRankingsByLeagueUuids(data.leagueUuids));

export const getSamsRankingByLeagueUuidFn = createServerFn()
  .validator(z.string())
  .handler(async ({ data }) => handleGetSamsRankingByLeagueUuid(data));

export const peekSamsRankingsCacheFn = createServerFn()
  .validator(z.object({ leagueUuids: z.array(z.string()) }))
  .handler(async ({ data }) => handlePeekSamsRankingsCache(data.leagueUuids));

export const readSamsMatchesCacheFn = createServerFn()
  .validator(samsMatchesInputSchema)
  .handler(async ({ data }) => handleReadSamsMatchesCache(data));

export const loadSamsMatchesForSsrFn = createServerFn()
  .validator(samsMatchesInputSchema)
  .handler(async ({ data }) => handleLoadSamsMatchesForSsr(data));

export const getSamsProjectionFreshnessFn = createServerFn().handler(async () =>
  handleGetSamsProjectionFreshness(),
);

export const listSamsClubsFn = createServerFn().handler(async () => handleListSamsClubs());

export const listSamsTeamsFn = createServerFn().handler(async () => handleListSamsTeams());

export const getSamsRosterByTeamUuidFn = createServerFn()
  .validator(z.string().min(1))
  .handler(async ({ data: teamUuid }) => handleGetSamsRosterByTeamUuid(teamUuid));

export const getSamsTickerFn = createServerFn().handler(async () => handleGetSamsTicker());
