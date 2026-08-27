/**
 * Deep module for SAMS league match loading — club resolution, season fallback,
 * cache read/write, API pagination, and post-fetch filtering.
 *
 * Match loading uses the **synced** seasonUuid from DynamoDB (teams sync output),
 * not SAMS live currentSeason — see docs/adr/0001-sams-match-loading.md.
 */

import type { LeagueMatchDto } from "sams-rest-v2";
import { sams } from "@/utils/sams-client";
import * as Sentry from "@sentry/tanstackstart-react";
import { createCacheKey } from "@utils/cache";
import dayjs from "dayjs";
import { filterAndSortSamsMatches } from "@utils/sams-match-filter";
import { SAMS_API_TIMEOUT_MS, SAMS_MATCHES_CACHE_TTL_MS } from "@utils/sams-api";
import type { SamsMatchesInput } from "@utils/sams-matches";
import {
  dedupeSamsMatchesByUuid,
  resolveEffectiveSamsSportsclubUuids,
  resolveSyncedSeasonUuidFromTeams,
  shouldResolveDefaultSamsSportsclubs,
} from "@utils/sams";
import { type LeagueMatchesResponse, LeagueMatchesResponseSchema } from "@/lambda/sams/types";
import { resolveConfiguredSamsClubsFromRecords } from "@/lib/sams/club-resolution";
import { getAllSamsClubs, getAllSamsTeams } from "../queries";
import { readCacheEntry, writeCacheEntry } from "../ddb-cache";
import { parseServerData } from "../schema-parse";

export type { SamsMatchesInput };

const MATCHES_CACHE_TTL_MS = SAMS_MATCHES_CACHE_TTL_MS;

type ResolvedSamsMatchesQuery = {
  league?: string;
  season?: string;
  sportsclub?: string;
  team?: string;
  limit?: number;
  range?: "past" | "future";
  effectiveSportsclubUuids: string[];
  cacheKey: string;
};

export type SamsMatchesForSsr = {
  cached: LeagueMatchesResponse | null;
  effectiveInput: SamsMatchesInput;
};

type CachedSamsMatchesLookup = {
  activeQuery: ResolvedSamsMatchesQuery;
  cached: LeagueMatchesResponse | null;
};

function toSamsMatchesInput(
  query: ResolvedSamsMatchesQuery,
  data?: SamsMatchesInput,
): SamsMatchesInput {
  return {
    league: query.league ?? data?.league,
    season: query.season ?? data?.season,
    sportsclub: query.sportsclub ?? data?.sportsclub,
    team: query.team ?? data?.team,
    limit: query.limit ?? data?.limit,
    range: query.range ?? data?.range,
  };
}

async function resolveConfiguredSamsSportsclubUuidsFromStorage(): Promise<string[]> {
  const { items } = await getAllSamsClubs();
  const { sportsclubUuids, missingClubSlugs } = resolveConfiguredSamsClubsFromRecords(items);

  if (missingClubSlugs.length > 0) {
    console.warn("Failed to resolve configured SAMS clubs", { missingClubSlugs });
  }

  return sportsclubUuids;
}

export function createSamsMatchesCacheKey(
  input: SamsMatchesInput,
  sportsclubUuids: readonly string[],
): string {
  return createCacheKey({
    type: "sams_matches",
    league: input.league,
    season: input.season,
    sportsclubUuids,
    team: input.team,
    limit: input.limit,
    range: input.range,
  });
}

async function resolveSyncedSeasonUuid(): Promise<string | undefined> {
  try {
    const syncedTeams = await getAllSamsTeams();
    return resolveSyncedSeasonUuidFromTeams(syncedTeams.items, {
      onDisagreement: (seasonUuids) => {
        console.warn("Synced SAMS teams disagree on season UUID", { seasonUuids });
      },
    });
  } catch (error) {
    console.warn("Failed to resolve synced SAMS season UUID; continuing without season filter", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/** Resolves effective SAMS match query params and cache key (without auto season lookup). */
export async function resolveSamsMatchesQuery(
  data?: SamsMatchesInput,
): Promise<ResolvedSamsMatchesQuery | null> {
  const { league, season, sportsclub, team } = data || {};

  const shouldUseDefaultSportsclubs = shouldResolveDefaultSamsSportsclubs({
    league,
    sportsclub,
    team,
  });
  const defaultSportsclubUuids = shouldUseDefaultSportsclubs
    ? await resolveConfiguredSamsSportsclubUuidsFromStorage()
    : [];
  if (shouldUseDefaultSportsclubs && defaultSportsclubUuids.length === 0) {
    return null;
  }

  const effectiveSportsclubUuids = resolveEffectiveSamsSportsclubUuids(
    { league, sportsclub, team },
    defaultSportsclubUuids,
  );

  const cacheKey = createSamsMatchesCacheKey(
    {
      league,
      season,
      sportsclub,
      team,
      limit: data?.limit,
      range: data?.range,
    },
    effectiveSportsclubUuids,
  );

  return {
    league,
    season,
    sportsclub,
    team,
    limit: data?.limit,
    range: data?.range,
    effectiveSportsclubUuids,
    cacheKey,
  };
}

async function resolveSeasonScopedSamsMatchesQuery(
  data: SamsMatchesInput | undefined,
  baseQuery: ResolvedSamsMatchesQuery,
): Promise<ResolvedSamsMatchesQuery | null> {
  if (baseQuery.season) return baseQuery;

  const syncedSeason = await resolveSyncedSeasonUuid();
  if (!syncedSeason) return null;

  return resolveSamsMatchesQuery({ ...data, season: syncedSeason });
}

/** Resolves effective match query params without cache or SAMS API (for SSR fallbacks). */
export async function resolveSamsMatchesEffectiveInput(
  data?: SamsMatchesInput,
): Promise<SamsMatchesInput | null> {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) return null;

  const seasonScopedQuery = resolvedQuery.season
    ? resolvedQuery
    : await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);

  return toSamsMatchesInput(seasonScopedQuery ?? resolvedQuery, data);
}

async function readCachedSamsMatchesWithSeasonFallback(
  data: SamsMatchesInput | undefined,
  resolvedQuery: ResolvedSamsMatchesQuery,
  maxAgeMs: number,
): Promise<CachedSamsMatchesLookup> {
  let activeQuery = resolvedQuery;
  let cached = await readCacheEntry<LeagueMatchesResponse>(activeQuery.cacheKey, maxAgeMs);
  if (!cached) {
    const seasonScopedQuery = await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);
    if (seasonScopedQuery) {
      activeQuery = seasonScopedQuery;
      cached = await readCacheEntry<LeagueMatchesResponse>(activeQuery.cacheKey, maxAgeMs);
    }
  }

  return { activeQuery, cached };
}

async function fetchAllSamsLeagueMatches({
  league,
  season,
  team,
  sportsclubUuids,
}: Pick<SamsMatchesInput, "league" | "season" | "team"> & {
  sportsclubUuids: readonly string[];
}): Promise<Omit<LeagueMatchDto, "_links">[]> {
  const sportsclubFilters = sportsclubUuids.length > 0 ? sportsclubUuids : [undefined];
  const allMatches: Omit<LeagueMatchDto, "_links">[] = [];

  for (const sportsclubUuid of sportsclubFilters) {
    const defaultQueryParams: Record<string, string> = {};
    if (league) defaultQueryParams["for-league"] = league;
    if (season) defaultQueryParams["for-season"] = season;
    if (sportsclubUuid) defaultQueryParams["for-sportsclub"] = sportsclubUuid;
    if (team) defaultQueryParams["for-team"] = team;

    let currentPage = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const { data: pageData } = await sams.getAllLeagueMatches({
        query: { ...defaultQueryParams, page: currentPage, size: 100 },
        signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
      });

      if (!pageData) {
        if (currentPage === 0) {
          console.warn("SAMS API returned no data on first page", {
            page: currentPage,
            sportsclubUuid,
            league,
            season,
            team,
          });
          Sentry.metrics.count("sams.league_matches.empty_response", 1, {
            attributes: {
              page: String(currentPage),
              sportsclub_uuid: sportsclubUuid ?? "",
              league: league ?? "",
              season: season ?? "",
              team: team ?? "",
            },
          });
        }
        break;
      }

      if (pageData.content?.length) {
        allMatches.push(...pageData.content.map(({ _links: _, ...match }) => match));
      }

      if (pageData.last === true) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }
  }

  return dedupeSamsMatchesByUuid(allMatches);
}

function emptyMatchesResponse(): LeagueMatchesResponse {
  return parseServerData(
    LeagueMatchesResponseSchema,
    { matches: [], timestamp: dayjs().toISOString() },
    "Failed to parse empty SAMS matches response",
  );
}

/** Loads league matches — cache first, then SAMS API on miss. May block on external API. */
export async function loadSamsMatches(data?: SamsMatchesInput): Promise<LeagueMatchesResponse> {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) {
    console.warn("No configured SAMS sportsclub UUIDs resolved; returning empty matches", {
      league: data?.league,
      season: data?.season,
    });
    return emptyMatchesResponse();
  }

  const { activeQuery, cached: cachedMatches } = await readCachedSamsMatchesWithSeasonFallback(
    data,
    resolvedQuery,
    MATCHES_CACHE_TTL_MS,
  );

  const { league, season, team, cacheKey, effectiveSportsclubUuids } = activeQuery;
  if (cachedMatches) return cachedMatches;

  const allMatches = await fetchAllSamsLeagueMatches({
    league,
    season,
    team,
    sportsclubUuids: effectiveSportsclubUuids,
  });

  const result = parseServerData(
    LeagueMatchesResponseSchema,
    {
      matches: filterAndSortSamsMatches(allMatches, data),
      timestamp: dayjs().toISOString(),
    },
    "Failed to parse SAMS matches response",
  );
  await writeCacheEntry(cacheKey, result);
  return result;
}

/**
 * Resolves cached matches plus effective query params for SSR (includes synced season when used).
 */
export async function resolveSamsMatchesForSsr(
  data?: SamsMatchesInput,
): Promise<SamsMatchesForSsr | null> {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) return null;

  const { activeQuery, cached } = await readCachedSamsMatchesWithSeasonFallback(
    data,
    resolvedQuery,
    Infinity,
  );

  return {
    cached,
    effectiveInput: toSamsMatchesInput(activeQuery, data),
  };
}

/** Cache read only — DynamoDB, no SAMS API. For explicit cache-peek RPCs. */
export async function readSamsMatchesCache(
  data?: SamsMatchesInput,
): Promise<LeagueMatchesResponse | null> {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) return null;

  const { cached } = await readCachedSamsMatchesWithSeasonFallback(data, resolvedQuery, Infinity);
  return cached;
}
