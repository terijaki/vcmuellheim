/**
 * Deep module for SAMS league match loading — club resolution, season fallback,
 * cache read/write, API pagination, and post-fetch filtering.
 *
 * Match loading uses the **synced** seasonUuid from DynamoDB (teams sync output),
 * not SAMS live currentSeason — see docs/adr/0001-sams-match-loading.md.
 */

import { getAllLeagueMatches, type LeagueMatchDto } from "@codegen/sams/generated";
import * as Sentry from "@sentry/tanstackstart-react";
import { createCacheKey } from "@utils/cache";
import dayjs from "dayjs";
import { type LeagueMatchesResponse, LeagueMatchesResponseSchema } from "@/lambda/sams/types";
import { getAllSamsTeams, getSamsClubByNameSlug } from "@webapp/server/queries";
import { readCacheEntry, writeCacheEntry } from "@webapp/server/ddb-cache";
import { parseServerData } from "@webapp/server/schema-parse";
import {
  dedupeSamsMatchesByUuid,
  SAMS_TARGET_CLUB_SLUGS,
  shouldResolveDefaultSamsSportsclubs,
  resolveEffectiveSamsSportsclubUuids,
} from "@utils/sams";
import { buildLeagueOrderingContext } from "@webapp/utils/ranking";

const SAMS_API_TIMEOUT_MS = 10_000;
const MATCHES_CACHE_TTL_MS = 5 * 60 * 1000;

export type SamsMatchesInput = {
  league?: string;
  season?: string;
  sportsclub?: string;
  team?: string;
  limit?: number;
  range?: "past" | "future";
};

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

async function resolveConfiguredSamsSportsclubUuidsFromStorage(): Promise<string[]> {
  const configuredClubs = await Promise.all(
    SAMS_TARGET_CLUB_SLUGS.map(async (clubSlug) => ({
      clubSlug,
      club: await getSamsClubByNameSlug(clubSlug),
    })),
  );

  const missingClubSlugs = configuredClubs
    .filter(({ club }) => !club?.sportsclubUuid)
    .map(({ clubSlug }) => clubSlug);

  if (missingClubSlugs.length > 0) {
    console.warn("Failed to resolve configured SAMS clubs", { missingClubSlugs });
  }

  return configuredClubs.flatMap(({ club }) => (club?.sportsclubUuid ? [club.sportsclubUuid] : []));
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

export { resolveEffectiveSamsSportsclubUuids };

async function resolveSyncedSeasonUuid(): Promise<string | undefined> {
  try {
    const syncedTeams = await getAllSamsTeams();
    return buildLeagueOrderingContext(syncedTeams.items).seasonUuid;
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
      const { data: pageData } = await getAllLeagueMatches({
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

      if (pageData.content) {
        allMatches.push(...pageData.content.map(({ _links: _, ...match }) => match));
        currentPage++;
      }

      if (pageData.last === true) hasMorePages = false;
    }
  }

  return dedupeSamsMatchesByUuid(allMatches);
}

function filterAndSortMatches(
  allMatches: Omit<LeagueMatchDto, "_links">[],
  data?: SamsMatchesInput,
): Omit<LeagueMatchDto, "_links">[] {
  let filteredMatches = allMatches;
  if (data?.range === "future") {
    filteredMatches = allMatches.filter((m) => !m.results?.winner);
    filteredMatches.sort((a, b) =>
      !a.date ? 1 : !b.date ? -1 : dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1,
    );
  } else if (data?.range === "past") {
    filteredMatches = allMatches.filter((m) => !!m.results?.winner);
    filteredMatches.sort((a, b) =>
      !a.date ? 1 : !b.date ? -1 : dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1,
    );
  }

  if (data?.limit) filteredMatches = filteredMatches.slice(0, data.limit);
  return filteredMatches;
}

function emptyMatchesResponse(): LeagueMatchesResponse {
  return parseServerData(
    LeagueMatchesResponseSchema,
    { matches: [], timestamp: new Date().toISOString() },
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

  let activeQuery = resolvedQuery;
  let cachedMatches = await readCacheEntry<LeagueMatchesResponse>(
    activeQuery.cacheKey,
    MATCHES_CACHE_TTL_MS,
  );
  if (!cachedMatches) {
    const seasonScopedQuery = await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);
    if (seasonScopedQuery) {
      activeQuery = seasonScopedQuery;
      cachedMatches = await readCacheEntry<LeagueMatchesResponse>(
        activeQuery.cacheKey,
        MATCHES_CACHE_TTL_MS,
      );
    }
  }

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
      matches: filterAndSortMatches(allMatches, data),
      timestamp: new Date().toISOString(),
    },
    "Failed to parse SAMS matches response",
  );
  await writeCacheEntry(cacheKey, result);
  return result;
}

/**
 * Cache-peek-only — reads DynamoDB without calling SAMS API.
 * Use in route loaders so navigation never blocks on a live SAMS fetch.
 */
export async function peekSamsMatches(
  data?: SamsMatchesInput,
): Promise<LeagueMatchesResponse | null> {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) return null;

  const cachedMatches = await readCacheEntry<LeagueMatchesResponse>(
    resolvedQuery.cacheKey,
    Infinity,
  );
  if (cachedMatches) return cachedMatches;

  const seasonScopedQuery = await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);
  if (!seasonScopedQuery) return null;

  return readCacheEntry<LeagueMatchesResponse>(seasonScopedQuery.cacheKey, Infinity);
}
