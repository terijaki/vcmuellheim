/**
 * SAMS server-only implementation — DB projections and live ticker.
 *
 * Import protection (`.server.ts` suffix) keeps this module out of client bundles.
 * Server function wrappers live in `sams.ts`; tests import helpers from here.
 */

import { createCacheKey, createExpiringCache, getOrSetExpiringCacheValue } from "@utils/cache";
import dayjs from "dayjs";
import { SAMS_API_TIMEOUT_MS } from "@utils/sams-api";
import { z } from "zod";
import {
  type LeagueMatch,
  type LeagueMatchesResponse,
  LeagueMatchesResponseSchema,
  type LiveMatch,
  type LiveTickerResponse,
  LiveTickerResponseSchema,
  type RankingResponse,
  RankingResponseSchema,
} from "@/lambda/sams/types";
import {
  appTabelleRepository,
  appTermineRepository,
  samsRankingProjectionRepository,
  samsScheduleProjectionRepository,
} from "@/lib/sams/repositories";
import type { AppTermineMatchInput } from "@/lib/db/schemas";
import { calculateLastResultCap } from "@webapp/utils/ranking";
import { resolveConfiguredSamsClubsFromRecords } from "@/lib/sams/club-resolution";
import {
  dedupeSamsMatchesByUuid,
  resolveSyncedSeasonUuidFromTeams,
  resolveEffectiveSamsSportsclubUuids,
  shouldResolveDefaultSamsSportsclubs,
} from "@utils/sams";
import {
  getAllSamsClubs,
  getAllSamsTeams,
  getSamsClubBySportsclubUuid,
  getSamsRosterByTeamUuid,
} from "../queries";
import { parseServerData } from "../schema-parse";
import { buildSamsMatchesHookOptions } from "@webapp/utils/sams-ssr";
import { clubLogoProxyUrl } from "@webapp/utils/club-logo";

const TICKER_FETCH_TIMEOUT_MS = SAMS_API_TIMEOUT_MS;
const GAMES_PER_TEAM_FOR_LAST_RESULTS = 2.3;

export type SamsMatchesInput = {
  league?: string;
  season?: string;
  sportsclub?: string;
  team?: string;
  limit?: number;
  range?: "past" | "future";
};

async function resolveConfiguredSamsSportsclubUuidsFromStorage(): Promise<string[]> {
  const { items } = await getAllSamsClubs();
  const { sportsclubUuids, missingClubSlugs } = resolveConfiguredSamsClubsFromRecords(items);
  if (missingClubSlugs.length > 0)
    console.warn("Failed to resolve configured SAMS clubs", { missingClubSlugs });
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
  options?: {
    defaultSportsclubUuids?: readonly string[];
  },
): Promise<ResolvedSamsMatchesQuery | null> {
  const { league, season, sportsclub, team } = data || {};

  const shouldUseDefaultSportsclubs = shouldResolveDefaultSamsSportsclubs({
    league,
    sportsclub,
    team,
  });
  const defaultSportsclubUuids =
    options?.defaultSportsclubUuids ??
    (shouldUseDefaultSportsclubs ? await resolveConfiguredSamsSportsclubUuidsFromStorage() : []);
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
  seasonUuid?: string,
): Promise<ResolvedSamsMatchesQuery | null> {
  if (baseQuery.season) return baseQuery;

  const syncedSeason = seasonUuid ?? (await resolveSyncedSeasonUuid());
  if (!syncedSeason) return null;

  return {
    ...baseQuery,
    season: syncedSeason,
    cacheKey: createSamsMatchesCacheKey(
      {
        league: data?.league,
        season: syncedSeason,
        sportsclub: data?.sportsclub,
        team: data?.team,
        limit: data?.limit,
        range: data?.range,
      },
      baseQuery.effectiveSportsclubUuids,
    ),
  };
}

type SamsPeekContext = {
  seasonUuid?: string;
  sportsclubUuids?: readonly string[];
};

async function loadMatchesFromProjections({
  league,
  season,
  team,
  sportsclubUuids,
}: Pick<SamsMatchesInput, "league" | "season" | "team"> & {
  sportsclubUuids: readonly string[];
}): Promise<LeagueMatch[]> {
  if (!season || sportsclubUuids.length === 0) return [];

  const projectionMatches = await samsScheduleProjectionRepository.listMatchesForSportsclubs(
    sportsclubUuids,
    season,
  );

  let matches = projectionMatches;

  if (league) {
    matches = matches.filter((match) => match.leagueUuid === league);
  }
  if (team) {
    matches = matches.filter((match) => match.team1.uuid === team || match.team2.uuid === team);
  }

  return dedupeSamsMatchesByUuid(matches);
}

/** Schedule projection matches for one or more SAMS team UUIDs (ICS calendar, etc.). */
export async function loadScheduleMatchesForSamsTeamUuids(
  teamUuids: string[],
): Promise<LeagueMatch[]> {
  if (teamUuids.length === 0) return [];

  const sportsclubUuids = await resolveConfiguredSamsSportsclubUuidsFromStorage();
  const { items: samsTeams } = await getAllSamsTeams();
  const seasonUuid = resolveSyncedSeasonUuidFromTeams(samsTeams, {
    onDisagreement: (seasonUuids) => {
      console.warn("Synced SAMS teams disagree on season UUID", { seasonUuids });
    },
  });
  if (!seasonUuid || sportsclubUuids.length === 0) return [];

  const teamUuidSet = new Set(teamUuids);
  const projectionMatches = await samsScheduleProjectionRepository.listMatchesForSportsclubs(
    sportsclubUuids,
    seasonUuid,
  );

  const filtered = projectionMatches.filter(
    (match) => teamUuidSet.has(match.team1.uuid) || teamUuidSet.has(match.team2.uuid),
  );

  return dedupeSamsMatchesByUuid(filtered);
}

function isPastProjectionMatch(match: { hasResult: boolean }): boolean {
  return match.hasResult;
}

async function buildMatchesResponse(
  data: SamsMatchesInput | undefined,
  query: ResolvedSamsMatchesQuery,
): Promise<LeagueMatchesResponse> {
  const { league, season, team, effectiveSportsclubUuids } = query;
  const allMatches = await loadMatchesFromProjections({
    league,
    season,
    team,
    sportsclubUuids: effectiveSportsclubUuids,
  });

  let filteredMatches = allMatches;
  if (data?.range === "future") {
    filteredMatches = allMatches.filter((match) => !isPastProjectionMatch(match));
    filteredMatches.sort((a, b) =>
      !a.date ? 1 : !b.date ? -1 : dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1,
    );
  } else if (data?.range === "past") {
    filteredMatches = allMatches.filter((match) => isPastProjectionMatch(match));
    filteredMatches.sort((a, b) =>
      !a.date ? 1 : !b.date ? -1 : dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1,
    );
  }

  if (data?.limit) filteredMatches = filteredMatches.slice(0, data.limit);

  return parseServerData(
    LeagueMatchesResponseSchema,
    { matches: filteredMatches, timestamp: new Date().toISOString() },
    "Failed to parse SAMS matches response",
  );
}

function withProxiedClubLogoUrl<T extends { sportsclubUuid?: string; logoUrl?: string }>(
  team: T,
): T {
  if (!team.sportsclubUuid || !team.logoUrl) return team;
  return { ...team, logoUrl: clubLogoProxyUrl(team.sportsclubUuid) };
}

function emptyRankingResponse(leagueUuid: string): RankingResponse {
  return {
    teams: [],
    timestamp: new Date().toISOString(),
    leagueUuid,
    leagueName: null,
    seasonName: null,
  };
}

function mapAppTermineMatchToLeagueMatch(match: AppTermineMatchInput): LeagueMatch {
  return {
    uuid: match.matchUuid,
    ...(match.date ? { date: match.date } : {}),
    ...(match.time ? { time: match.time } : {}),
    ...(match.leagueUuid ? { leagueUuid: match.leagueUuid } : {}),
    ...(match.seasonUuid ? { seasonUuid: match.seasonUuid } : {}),
    team1: match.team1,
    team2: match.team2,
    ...(match.location ? { location: match.location } : {}),
    ...(match.result ? { result: match.result } : {}),
    hasResult: match.hasResult,
  };
}

function rankingResponseFromAppTabelle(league: {
  leagueUuid: string;
  leagueName: string;
  seasonName?: string;
  teams: RankingResponse["teams"];
  updatedAt: string;
}): RankingResponse {
  return parseServerData(
    RankingResponseSchema,
    {
      teams: (league.teams ?? []).map(withProxiedClubLogoUrl),
      timestamp: league.updatedAt,
      leagueUuid: league.leagueUuid,
      leagueName: league.leagueName,
      seasonName: league.seasonName,
    },
    "Failed to parse app Tabelle ranking response",
  );
}

/** Current Tabelle read model — no season/club discovery at request time. */
export async function handleGetCurrentTabelle() {
  const leagues = await appTabelleRepository.listByDataset();
  const rankings = leagues.map(rankingResponseFromAppTabelle);
  const ownedTeamUuids = [...new Set(leagues.flatMap((league) => league.ownedTeamUuids))].sort(
    (a, b) => a.localeCompare(b),
  );
  const lastResultCap = calculateLastResultCap(
    Math.max(ownedTeamUuids.length, 1),
    GAMES_PER_TEAM_FOR_LAST_RESULTS,
  );

  return {
    leagueUuids: leagues.map((league) => league.leagueUuid),
    rankingsByLeagueUuid: Object.fromEntries(
      rankings.map((ranking) => [ranking.leagueUuid, ranking]),
    ) as Record<string, RankingResponse>,
    ownedTeamUuids,
    lastResultCap,
    seasonUuid: leagues[0]?.seasonUuid,
    seasonName: leagues[0]?.seasonName,
    timestamp: leagues[0]?.updatedAt ?? new Date().toISOString(),
  };
}

/** Current Termine read model — date-range query against the application projection. */
export async function handleGetCurrentTermine(input?: {
  range?: "past" | "future";
  limit?: number;
  homeOnly?: boolean;
  team?: string;
}) {
  let matches = await appTermineRepository.query({
    range: input?.range,
    limit: input?.team ? undefined : input?.limit,
    homeOnly: input?.homeOnly,
  });

  if (input?.team) {
    matches = matches.filter(
      (match) => match.team1.uuid === input.team || match.team2.uuid === input.team,
    );
    if (input.limit) matches = matches.slice(0, input.limit);
  }

  const ownedTeamUuids = [...new Set(matches.flatMap((match) => match.ownedTeamUuids))].sort(
    (a, b) => a.localeCompare(b),
  );

  const response = parseServerData(
    LeagueMatchesResponseSchema,
    {
      matches: matches.map(mapAppTermineMatchToLeagueMatch),
      timestamp: matches[0]?.updatedAt ?? new Date().toISOString(),
    },
    "Failed to parse app Termine response",
  );

  return {
    ...response,
    ownedTeamUuids,
    matchesWithMeta: matches.map((match) => ({
      ...mapAppTermineMatchToLeagueMatch(match),
      leagueName: match.leagueName,
      isHomeGame: match.isHomeGame,
    })),
  };
}

function canUseAppTermineReadModel(data?: SamsMatchesInput): boolean {
  return !data?.league && !data?.sportsclub && !data?.season;
}

async function fetchSamsRankingsByLeagueUuid(leagueUuid: string): Promise<RankingResponse> {
  const appLeagues = await appTabelleRepository.listByDataset();
  const appLeague = appLeagues.find((league) => league.leagueUuid === leagueUuid);
  if (appLeague) {
    return rankingResponseFromAppTabelle(appLeague);
  }

  const seasonUuid = await resolveSyncedSeasonUuid();
  if (!seasonUuid) {
    return emptyRankingResponse(leagueUuid);
  }

  const projection = await samsRankingProjectionRepository.get(leagueUuid, seasonUuid);
  if (!projection) {
    return emptyRankingResponse(leagueUuid);
  }

  return parseServerData(
    RankingResponseSchema,
    {
      teams: projection.teams.map(withProxiedClubLogoUrl),
      timestamp: projection.updatedAt,
      leagueUuid,
      leagueName: projection.leagueName,
      seasonName: projection.seasonName,
    },
    "Failed to parse SAMS rankings response",
  );
}

async function peekRankingProjectionForSeason(
  leagueUuid: string,
  seasonUuid: string,
): Promise<RankingResponse | null> {
  const projection = await samsRankingProjectionRepository.get(leagueUuid, seasonUuid);
  if (!projection) return null;

  return parseServerData(
    RankingResponseSchema,
    {
      teams: projection.teams.map(withProxiedClubLogoUrl),
      timestamp: projection.updatedAt,
      leagueUuid,
      leagueName: projection.leagueName,
      seasonName: projection.seasonName,
    },
    "Failed to parse SAMS rankings projection",
  );
}

// ── SAMS projections — Matches ───────────────────────────────────────────────

export async function handleGetSamsMatches(data?: SamsMatchesInput) {
  if (canUseAppTermineReadModel(data)) {
    const appTermine = await handleGetCurrentTermine({
      range: data?.range,
      limit: data?.limit,
      team: data?.team,
    });
    return parseServerData(
      LeagueMatchesResponseSchema,
      { matches: appTermine.matches, timestamp: appTermine.timestamp },
      "Failed to parse app Termine matches response",
    );
  }

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
  if (!activeQuery.season) {
    const seasonScopedQuery = await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);
    if (!seasonScopedQuery) {
      return parseServerData(
        LeagueMatchesResponseSchema,
        { matches: [], timestamp: new Date().toISOString() },
        "Failed to parse empty SAMS matches response",
      );
    }
    activeQuery = seasonScopedQuery;
  }

  return buildMatchesResponse(data, activeQuery);
}

// ── SAMS projections — Rankings ──────────────────────────────────────────────

export async function handleGetSamsRankingsByLeagueUuids(leagueUuids: string[]) {
  return Promise.all(leagueUuids.map((leagueUuid) => fetchSamsRankingsByLeagueUuid(leagueUuid)));
}

export async function handleGetSamsRankingByLeagueUuid(leagueUuid: string) {
  return fetchSamsRankingsByLeagueUuid(leagueUuid);
}

/** Projection peek for rankings — prefers application Tabelle read model. */
export async function handlePeekSamsRankingsCache(
  leagueUuids: string[],
  context?: Pick<SamsPeekContext, "seasonUuid">,
) {
  const appTabelle = await handleGetCurrentTabelle();
  if (appTabelle.leagueUuids.length > 0) {
    return leagueUuids
      .map((leagueUuid) => appTabelle.rankingsByLeagueUuid[leagueUuid])
      .filter((ranking): ranking is RankingResponse => ranking !== undefined);
  }

  const seasonUuid = context?.seasonUuid ?? (await resolveSyncedSeasonUuid());
  if (!seasonUuid) return [];

  const results = await Promise.all(
    leagueUuids.map((leagueUuid) => peekRankingProjectionForSeason(leagueUuid, seasonUuid)),
  );
  return results.filter((result): result is RankingResponse => result !== null);
}

/** Projection peek for matches — prefers application Termine read model. */
export async function handlePeekSamsMatchesCache(
  data?: SamsMatchesInput,
  context?: SamsPeekContext,
) {
  if (canUseAppTermineReadModel(data)) {
    const appTermine = await handleGetCurrentTermine({
      range: data?.range,
      limit: data?.limit,
      team: data?.team,
    });
    return appTermine.matches.length > 0
      ? parseServerData(
          LeagueMatchesResponseSchema,
          { matches: appTermine.matches, timestamp: appTermine.timestamp },
          "Failed to parse app Termine peek response",
        )
      : null;
  }

  const resolvedQuery = await resolveSamsMatchesQuery(data, {
    defaultSportsclubUuids: context?.sportsclubUuids,
  });
  if (!resolvedQuery) return null;

  let activeQuery = resolvedQuery;
  if (!activeQuery.season) {
    const seasonScopedQuery = await resolveSeasonScopedSamsMatchesQuery(
      data,
      resolvedQuery,
      data?.season ?? context?.seasonUuid,
    );
    if (!seasonScopedQuery) return null;
    activeQuery = seasonScopedQuery;
  }

  const response = await buildMatchesResponse(data, activeQuery);
  return response.matches.length > 0 ? response : null;
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

export async function handleGetSamsRosterByTeamUuid(teamUuid: string) {
  return getSamsRosterByTeamUuid(teamUuid);
}

const CLUB_LOGO_MAX_BYTES = 512 * 1024;
const CLUB_LOGO_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";
const CLUB_LOGO_ERROR_CACHE_CONTROL = "public, max-age=60";

function logoErrorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": CLUB_LOGO_ERROR_CACHE_CONTROL },
  });
}

function isImageContentType(value: string): boolean {
  const mime = value.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime.startsWith("image/") || mime === "application/octet-stream";
}

function responseFromDataUri(uri: string): Response {
  if (!uri.startsWith("data:")) return logoErrorResponse(404, "Invalid logo");
  const comma = uri.indexOf(",");
  if (comma < 0) return logoErrorResponse(404, "Invalid logo");
  const header = uri.slice("data:".length, comma);
  const data = uri.slice(comma + 1);
  const [mime, ...params] = header.split(";");
  const isBase64 = params.some((param) => param === "base64");
  const charset = params.find((param) => param.startsWith("charset="));
  const body = isBase64
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf8");
  if (body.byteLength > CLUB_LOGO_MAX_BYTES) return logoErrorResponse(502, "Logo too large");
  const contentType = charset
    ? `${mime || "application/octet-stream"};${charset}`
    : mime || "application/octet-stream";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": CLUB_LOGO_CACHE_CONTROL,
    },
  });
}

export async function handleServeClubLogo(clubUuid: string): Promise<Response> {
  const club = await getSamsClubBySportsclubUuid(clubUuid);
  const source = club?.logoImageLink;
  if (!source) return logoErrorResponse(404, "Not found");
  if (source.startsWith("data:")) return responseFromDataUri(source);
  if (!source.startsWith("https://")) return logoErrorResponse(404, "Unsupported logo URL");

  try {
    const upstream = await fetch(source, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!upstream.ok) return logoErrorResponse(502, "Logo fetch failed");
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!isImageContentType(contentType)) return logoErrorResponse(502, "Logo fetch failed");
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength > CLUB_LOGO_MAX_BYTES) return logoErrorResponse(502, "Logo too large");
    const mime = contentType.split(";")[0]?.trim() || "application/octet-stream";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": CLUB_LOGO_CACHE_CONTROL,
      },
    });
  } catch {
    return logoErrorResponse(502, "Logo fetch failed");
  }
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
        signal: AbortSignal.timeout(TICKER_FETCH_TIMEOUT_MS),
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

export async function resolveSamsMatchesEffectiveInput(
  data?: SamsMatchesInput,
): Promise<SamsMatchesInput | null> {
  const resolvedQuery = await resolveSamsMatchesQuery(data);
  if (!resolvedQuery) return null;
  const seasonScopedQuery = resolvedQuery.season
    ? resolvedQuery
    : await resolveSeasonScopedSamsMatchesQuery(data, resolvedQuery);
  const active = seasonScopedQuery ?? resolvedQuery;
  return {
    league: active.league,
    season: active.season,
    sportsclub: active.sportsclub,
    team: active.team,
    limit: active.limit,
    range: active.range,
  };
}
export async function handleReadSamsMatchesCache(data?: SamsMatchesInput) {
  return handlePeekSamsMatchesCache(data);
}
export async function handleLoadSamsMatchesForSsr(input?: SamsMatchesInput) {
  if (canUseAppTermineReadModel(input)) {
    const appTermine = await handleGetCurrentTermine({
      range: input?.range,
      limit: input?.limit,
      team: input?.team,
    });
    const cached =
      appTermine.matches.length > 0
        ? parseServerData(
            LeagueMatchesResponseSchema,
            { matches: appTermine.matches, timestamp: appTermine.timestamp },
            "Failed to parse app Termine SSR response",
          )
        : undefined;
    const effectiveInput: SamsMatchesInput = {
      ...(input?.range ? { range: input.range } : {}),
      ...(input?.limit !== undefined ? { limit: input.limit } : {}),
      ...(input?.team ? { team: input.team } : {}),
    };
    return { cached, hookOptions: buildSamsMatchesHookOptions(effectiveInput, cached ?? null) };
  }

  let cached: LeagueMatchesResponse | undefined;
  let effectiveInput: SamsMatchesInput;
  try {
    cached = (await handlePeekSamsMatchesCache(input)) ?? undefined;
    effectiveInput = (await resolveSamsMatchesEffectiveInput(input)) ?? input ?? {};
  } catch (error) {
    console.warn("SAMS SSR match load failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    effectiveInput = (await resolveSamsMatchesEffectiveInput(input)) ?? input ?? {};
  }
  return { cached, hookOptions: buildSamsMatchesHookOptions(effectiveInput, cached ?? null) };
}

export async function handleGetSamsProjectionFreshness() {
  const [tabelle, termine] = await Promise.all([
    appTabelleRepository.listByDataset(),
    appTermineRepository.query({ limit: 1 }),
  ]);
  const updatedAts = [
    ...tabelle.map((league) => league.updatedAt),
    ...termine.map((match) => match.updatedAt),
  ].filter((value): value is string => !!value);
  if (updatedAts.length > 0) {
    return { maxUpdatedAt: updatedAts.reduce((max, value) => (value > max ? value : max)) };
  }

  const sportsclubUuids = await resolveConfiguredSamsSportsclubUuidsFromStorage();
  const seasonUuid = await resolveSyncedSeasonUuid();
  if (!seasonUuid || sportsclubUuids.length === 0) return { maxUpdatedAt: null as string | null };
  const schedules = await Promise.all(
    sportsclubUuids.map((id) => samsScheduleProjectionRepository.get(id, seasonUuid)),
  );
  const scheduleUpdatedAts = schedules.map((s) => s?.updatedAt).filter((v): v is string => !!v);
  if (!scheduleUpdatedAts.length) return { maxUpdatedAt: null as string | null };
  return { maxUpdatedAt: scheduleUpdatedAts.reduce((max, v) => (v > max ? v : max)) };
}
