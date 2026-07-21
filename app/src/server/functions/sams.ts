/**
 * SAMS server functions for read and sync triggers.
 * Read paths use server functions in this app; sync runs via scheduled Lambdas.
 *
 * Server-only logic lives in sams.server.ts (import-protected). This file exports
 * createServerFn wrappers that are safe to import from client code.
 */

import { createServerFn } from "@tanstack/react-start";
import { samsMatchesInputSchema } from "@utils/sams-matches";
import { z } from "zod";
import { requireAdminMiddleware } from "../../middleware";
import {
  handleGetClubLogoUrl,
  handleGetClubLogoUrlsBatch,
  handleGetSamsMatches,
  handleGetSamsRankingByLeagueUuid,
  handleGetSamsRankingsByLeagueUuids,
  handleGetSamsRosterByTeamUuid,
  handleGetSamsTicker,
  handleListSamsClubs,
  handleListSamsTeams,
  handleLoadSamsMatchesForSsr,
  handlePeekSamsMatchesCache,
  handlePeekSamsRankingsCache,
  handleTriggerSamsClubsSync,
  handleTriggerSamsTeamsSync,
} from "./sams.server";

export type { SamsMatchesInput } from "@utils/sams-matches";
export type { SamsMatchesHookOptions } from "@webapp/utils/sams-ssr";

const clubLogoInputSchema = z.union([
  z.object({ clubUuid: z.string().min(1), clubSlug: z.undefined().optional() }),
  z.object({ clubSlug: z.string().min(1), clubUuid: z.undefined().optional() }),
]);

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

export const peekSamsMatchesCacheFn = createServerFn()
  .validator(samsMatchesInputSchema)
  .handler(async ({ data }) => handlePeekSamsMatchesCache(data));

/** SSR loader helper — peek-only, returns hook options for useSamsMatches. */
export const loadSamsMatchesForSsrFn = createServerFn()
  .validator(samsMatchesInputSchema)
  .handler(async ({ data }) => handleLoadSamsMatchesForSsr(data));

export const listSamsClubsFn = createServerFn().handler(async () => handleListSamsClubs());

export const listSamsTeamsFn = createServerFn().handler(async () => handleListSamsTeams());

export const getSamsRosterByTeamUuidFn = createServerFn()
  .validator(z.string().min(1))
  .handler(async ({ data: teamUuid }) => handleGetSamsRosterByTeamUuid(teamUuid));

export const getClubLogoUrlFn = createServerFn()
  .validator(clubLogoInputSchema)
  .handler(async ({ data }) => handleGetClubLogoUrl(data));

export const getClubLogoUrlsBatchFn = createServerFn()
  .validator(z.object({ clubSlugs: z.array(z.string().min(1)) }))
  .handler(async ({ data }) => handleGetClubLogoUrlsBatch(data.clubSlugs));

export const getSamsTickerFn = createServerFn().handler(async () => handleGetSamsTicker());

export const triggerSamsClubsSyncFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .handler(async () => handleTriggerSamsClubsSync());

export const triggerSamsTeamsSyncFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .handler(async () => handleTriggerSamsTeamsSync());
