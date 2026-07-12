/**
 * SAMS server-only implementation — DB, AWS SDK, and SAMS API access.
 *
 * Import protection (`.server.ts` suffix) keeps this module out of client bundles.
 * Server function wrappers live in `sams.ts`; tests import helpers from here.
 */

import {
  getAllLeagueMatches,
  getLeagueByUuid,
  getRankingsForLeague,
  getSeasonByUuid,
  type LeagueMatchDto,
} from "@codegen/sams/generated";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { createCacheKey, createExpiringCache, getOrSetExpiringCacheValue } from "@utils/cache";
import dayjs from "dayjs";
import { z } from "zod";
import {
  type LeagueMatchesResponse,
  LeagueMatchesResponseSchema,
  type LiveMatch,
  type LiveTickerResponse,
  LiveTickerResponseSchema,
  type RankingResponse,
  RankingResponseSchema,
} from "@/lambda/sams/types";
import {
  getAllSamsClubs,
  getAllSamsTeams,
  getSamsClubByNameSlug,
  getSamsClubByNameSlugPrefix,
  getSamsClubBySportsclubUuid,
} from "../queries";
import { readCacheEntry, writeCacheEntry } from "../ddb-cache";
import { parseServerData } from "../schema-parse";
import {
  dedupeSamsMatchesByUuid,
  SAMS_TARGET_CLUB_SLUGS,
  shouldResolveDefaultSamsSportsclubs,
} from "@/utils/sams";
import { buildLeagueOrderingContext } from "@webapp/utils/ranking";

const MEDIA_CLOUDFRONT_URL = () => process.env.MEDIA_CLOUDFRONT_URL || "";

const SAMS_API_TIMEOUT_MS = 10_000;

export type SamsMatchesInput = {
  league?: string;
  season?: string;
  sportsclub?: string;
  team?: string;
  limit?: number;
  range?: "past" | "future";
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

export function resolveEffectiveSamsSportsclubUuids(
  input: Pick<SamsMatchesInput, "league" | "sportsclub" | "team">,
  defaultSportsclubUuids: readonly string[],
): string[] {
  if (input.sportsclub) return [input.sportsclub];
  if (!shouldResolveDefaultSamsSportsclubs(input)) return [];
  return [...defaultSportsclubUuids];
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
          throw new Error(`SAMS API returned no data on page ${currentPage}`);
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

async function fetchSamsRankingsByLeagueUuid(leagueUuid: string): Promise<RankingResponse> {
  const cacheKey = createCacheKey({ type: "sams_rankings", leagueUuid });
  const cached = await readCacheEntry<RankingResponse>(cacheKey, 5 * 60 * 1000);
  if (cached) return cached;

  const [{ data: rankingsData }, { data: leagueData }] = await Promise.all([
    getRankingsForLeague({
      path: { uuid: leagueUuid },
      query: { page: 0, size: 100 },
      signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
    }),
    getLeagueByUuid({
      path: { uuid: leagueUuid },
      signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
    }),
  ]);

  if (!rankingsData?.content) throw new Error("No rankings found for this league");

  let leagueName: string | undefined;
  let seasonName: string | undefined;

  if (leagueData?.name) leagueName = leagueData.name;

  if (leagueData?.seasonUuid) {
    const { data: seasonData } = await getSeasonByUuid({
      path: { uuid: leagueData.seasonUuid },
      signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
    });
    if (seasonData?.name) seasonName = seasonData.name;
  }

  const result = parseServerData(
    RankingResponseSchema,
    {
      teams: rankingsData.content,
      timestamp: new Date().toISOString(),
      leagueUuid,
      leagueName,
      seasonName,
    },
    "Failed to parse SAMS rankings response",
  );

  await writeCacheEntry(cacheKey, result);
  return result;
}

// ── SAMS API proxy — Matches ─────────────────────────────────────────────────

export async function handleGetSamsMatches(data?: SamsMatchesInput) {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) {
    console.warn("No configured SAMS sportsclub UUIDs resolved; returning empty matches", {
      league: data?.league,
      season: data?.season,
    });
    return parseServerData(
      LeagueMatchesResponseSchema,
      { matches: [], timestamp: new Date().toISOString() },
      "Failed to parse empty SAMS matches response",
    );
  }

  let activeQuery = resolvedQuery;
  let cachedMatches = await readCacheEntry<LeagueMatchesResponse>(
    activeQuery.cacheKey,
    5 * 60 * 1000,
  );
  if (!cachedMatches) {
    const seasonScopedQuery = await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);
    if (seasonScopedQuery) {
      activeQuery = seasonScopedQuery;
      cachedMatches = await readCacheEntry<LeagueMatchesResponse>(
        activeQuery.cacheKey,
        5 * 60 * 1000,
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

  const result = parseServerData(
    LeagueMatchesResponseSchema,
    { matches: filteredMatches, timestamp: new Date().toISOString() },
    "Failed to parse SAMS matches response",
  );
  await writeCacheEntry(cacheKey, result);
  return result;
}

// ── SAMS API proxy — Rankings ────────────────────────────────────────────────

export async function handleGetSamsRankingsByLeagueUuids(leagueUuids: string[]) {
  return Promise.all(leagueUuids.map((leagueUuid) => fetchSamsRankingsByLeagueUuid(leagueUuid)));
}

export async function handleGetSamsRankingByLeagueUuid(leagueUuid: string) {
  return fetchSamsRankingsByLeagueUuid(leagueUuid);
}

/**
 * Cache-peek-only variant for rankings: reads from DynamoDB without calling SAMS API.
 * Returns whatever is cached regardless of age — any data is better than a skeleton.
 * React Query handles freshness via its queryFn (getSamsRankingsByLeagueUuidsFn).
 */
export async function handlePeekSamsRankingsCache(leagueUuids: string[]) {
  const results = await Promise.all(
    leagueUuids.map((leagueUuid) => {
      const cacheKey = createCacheKey({ type: "sams_rankings", leagueUuid });
      return readCacheEntry<RankingResponse>(cacheKey, Infinity);
    }),
  );
  return results.filter((r): r is RankingResponse => r !== null);
}

/**
 * Cache-peek-only variant for matches: resolves the effective filter params (including the
 * default sportsclub UUID) and returns the cached entry if present, otherwise null.
 * Use in route loaders to keep navigation fast — React Query will fetch live data client-side.
 */
export async function handlePeekSamsMatchesCache(data?: SamsMatchesInput) {
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

export async function handleListSamsClubs() {
  const result = await getAllSamsClubs();
  return {
    items: result.items,
    clubs: result.items,
    lastEvaluatedKey: result.lastEvaluatedKey,
  };
}

export async function handleListSamsTeams() {
  const result = await getAllSamsTeams();
  return {
    items: result.items,
    teams: result.items,
    lastEvaluatedKey: result.lastEvaluatedKey,
  };
}

type ClubLogoInput =
  | { clubUuid: string; clubSlug?: undefined }
  | { clubSlug: string; clubUuid?: undefined };

export async function handleGetClubLogoUrl(data: ClubLogoInput) {
  const club = data.clubUuid
    ? await getSamsClubBySportsclubUuid(data.clubUuid)
    : data.clubSlug
      ? await getSamsClubByNameSlug(data.clubSlug)
      : null;
  return resolveClubLogoUrl(club, MEDIA_CLOUDFRONT_URL());
}

export async function handleGetClubLogoUrlsBatch(clubSlugs: string[]) {
  const cfUrl = MEDIA_CLOUDFRONT_URL();
  const entries = await Promise.all(
    clubSlugs.map(async (slug) => {
      const club = (await getSamsClubByNameSlug(slug)) ?? (await getSamsClubByNameSlugPrefix(slug));
      return [slug, resolveClubLogoUrl(club, cfUrl)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<string, string | null>;
}

/** Pure helper — resolves a club's effective logo URL from a club record.
 * Exported for unit testing. */
export function resolveClubLogoUrl(
  club: { logoS3Key?: string | null; logoImageLink?: string | null } | null,
  cloudfrontUrl: string,
): string | null {
  if (!club) return null;
  if (club.logoS3Key && cloudfrontUrl) return `${cloudfrontUrl}/${club.logoS3Key}`;
  return club.logoImageLink ?? null;
}

// ── SAMS Live Ticker proxy ────────────────────────────────────────────────────

const TICKER_URL = "https://backend.sams-ticker.de/live/indoor/tickers/baden";
const TICKER_CACHE_TTL_MS = 10_000;

type TickerCacheValue = {
  data: LiveTickerResponse;
};

const tickerCache = createExpiringCache<TickerCacheValue>();

const RawTickerMatchSchema = z
  .object({
    id: z.string(),
    date: z.union([z.string(), z.number()]).optional(),
    teamDescription1: z.string().optional(),
    team1: z.string(),
    teamDescription2: z.string().optional(),
    team2: z.string(),
  })
  .loose();

const RawTickerMatchDaySchema = z
  .object({
    date: z.string().optional(),
    matches: z.array(RawTickerMatchSchema).optional().default([]),
  })
  .loose();

const RawTickerMatchStateSchema = z
  .object({
    started: z.boolean().optional().default(false),
    finished: z.boolean().optional().default(false),
    setPoints: z.object({ team1: z.number(), team2: z.number() }).optional(),
    matchSets: z
      .array(
        z.object({
          setNumber: z.number(),
          setScore: z.object({ team1: z.number(), team2: z.number() }),
        }),
      )
      .optional()
      .default([]),
  })
  .loose();

const RawTickerResponseSchema = z
  .object({
    matchDays: z.array(RawTickerMatchDaySchema).optional().default([]),
    matchStates: z.record(z.string(), RawTickerMatchStateSchema).optional().default({}),
  })
  .loose();

export function buildLiveMatchesFromRaw(raw: z.infer<typeof RawTickerResponseSchema>): LiveMatch[] {
  // Build matchUuid → team metadata map from matchDays
  const matchTeamMap = new Map<
    string,
    {
      team1Uuid: string;
      team2Uuid: string;
      team1Name: string;
      team2Name: string;
      matchDate?: string | number;
    }
  >();
  for (const day of raw.matchDays) {
    for (const match of day.matches) {
      matchTeamMap.set(match.id, {
        team1Uuid: match.team1,
        team2Uuid: match.team2,
        team1Name: match.teamDescription1 ?? match.team1,
        team2Name: match.teamDescription2 ?? match.team2,
        matchDate: match.date ?? day.date,
      });
    }
  }

  const today = dayjs();

  // Only include started matches from today that have team metadata
  const liveMatches: LiveMatch[] = [];
  for (const [matchUuid, state] of Object.entries(raw.matchStates)) {
    if (!state.started) continue;
    const teams = matchTeamMap.get(matchUuid);
    if (!teams) continue;
    if (
      !teams.matchDate ||
      !dayjs(teams.matchDate).isValid() ||
      !dayjs(teams.matchDate).isSame(today, "day")
    )
      continue;
    liveMatches.push({
      matchUuid,
      team1Uuid: teams.team1Uuid,
      team2Uuid: teams.team2Uuid,
      team1Name: teams.team1Name,
      team2Name: teams.team2Name,
      state: {
        started: state.started,
        finished: state.finished,
        setPoints: state.setPoints ?? { team1: 0, team2: 0 },
        matchSets: state.matchSets,
      },
    });
  }
  return liveMatches;
}

export async function handleGetSamsTicker() {
  const result = await getOrSetExpiringCacheValue({
    cache: tickerCache,
    keyParts: { resource: "sams-live-ticker" },
    ttlMs: TICKER_CACHE_TTL_MS,
    load: async () => {
      const response = await fetch(TICKER_URL, {
        signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`SAMS ticker returned ${response.status}`);

      const raw = parseServerData(
        RawTickerResponseSchema,
        await response.json(),
        "Failed to parse SAMS ticker response",
      );
      const liveMatches = buildLiveMatchesFromRaw(raw);

      return {
        data: parseServerData(
          LiveTickerResponseSchema,
          {
            liveMatches,
            timestamp: new Date().toISOString(),
          },
          "Failed to parse SAMS live ticker response",
        ),
      };
    },
  });

  return result.data;
}

// ── Admin: SAMS sync triggers ────────────────────────────────────────────────

/** Invokes a SAMS sync Lambda asynchronously (InvocationType: "Event"). Exported for testing. */
export async function invokeSamsLambdaAsync(functionName: string, label: string): Promise<void> {
  const client = new LambdaClient();
  const result = await client.send(
    new InvokeCommand({ FunctionName: functionName, InvocationType: "Event" }),
  );
  if (result.StatusCode !== 202) {
    throw new Error(`${label} trigger failed: StatusCode=${result.StatusCode}`);
  }
}

export async function handleTriggerSamsClubsSync() {
  const functionName = process.env.SAMS_CLUBS_SYNC_FUNCTION_NAME;
  if (!functionName) throw new Error("SAMS_CLUBS_SYNC_FUNCTION_NAME is not configured");
  await invokeSamsLambdaAsync(functionName, "SAMS clubs sync");
}

export async function handleTriggerSamsTeamsSync() {
  const functionName = process.env.SAMS_TEAMS_SYNC_FUNCTION_NAME;
  if (!functionName) throw new Error("SAMS_TEAMS_SYNC_FUNCTION_NAME is not configured");
  await invokeSamsLambdaAsync(functionName, "SAMS teams sync");
}
