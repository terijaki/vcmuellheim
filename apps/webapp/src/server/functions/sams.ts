/**
 * SAMS server functions — replaces lib/trpc/routers/samsClubs.ts + samsTeams.ts
 * plus the read lambdas from SamsApiStack (matches, rankings).
 * All read-only, public.
 */

import { getAllLeagueHierarchies, getAllLeagueMatches, getAllLeagues, getLeagueByUuid, getRankingsForLeague, getSeasonByUuid, type LeagueMatchDto } from "@codegen/sams/generated";
import { Club } from "@project.config";
import { createServerFn } from "@tanstack/react-start";
import { createCacheKey, createExpiringCache, getOrSetExpiringCacheValue } from "@utils/cache";
import { slugify } from "@utils/slugify";
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
import { getAllSamsClubs, getAllSamsTeams, getSamsClubByNameSlug, getSamsClubByNameSlugPrefix, getSamsClubBySportsclubUuid } from "../queries";
import { readSamsCacheEntry, writeSamsCacheEntry } from "../sams-ddb-cache";
import { parseServerData } from "../schema-parse";

const CLOUDFRONT_URL = () => process.env.CLOUDFRONT_URL || "";

const SAMS_API_TIMEOUT_MS = 10_000;

async function listAllLeaguesForSeason(options: { seasonUuid?: string; associationUuid?: string }) {
	const leaguesByUuid = new Map<string, { leagueHierarchyUuid?: string }>();
	let page = 0;
	let hasMorePages = true;

	while (hasMorePages) {
		const { data } = await getAllLeagues({
			query: {
				page,
				size: 100,
				association: options.associationUuid,
				season: options.seasonUuid,
			},
			signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
		});

		for (const league of data?.content ?? []) {
			if (!league.uuid) continue;
			leaguesByUuid.set(league.uuid, { leagueHierarchyUuid: league.leagueHierarchyUuid });
		}

		hasMorePages = data?.last !== true;
		page++;
	}

	return leaguesByUuid;
}

async function listAllLeagueHierarchyLevels(options: { seasonUuid?: string; associationUuid?: string }) {
	const hierarchyLevelByUuid = new Map<string, number>();
	let page = 0;
	let hasMorePages = true;

	while (hasMorePages) {
		const { data } = await getAllLeagueHierarchies({
			query: {
				page,
				size: 100,
				association: options.associationUuid,
				"for-season": options.seasonUuid,
			},
			signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
		});

		for (const hierarchy of data?.content ?? []) {
			if (!hierarchy.uuid || hierarchy.level === undefined) continue;
			hierarchyLevelByUuid.set(hierarchy.uuid, hierarchy.level);
		}

		hasMorePages = data?.last !== true;
		page++;
	}

	return hierarchyLevelByUuid;
}

async function fetchLeagueLevelsByLeagueUuid(options: { leagueUuids: string[]; seasonUuid?: string; associationUuid?: string }) {
	const cacheKey = createCacheKey({ type: "sams_league_levels", leagueUuids: options.leagueUuids, seasonUuid: options.seasonUuid, associationUuid: options.associationUuid });
	const cached = await readSamsCacheEntry<Record<string, number | null>>(cacheKey, 24 * 60 * 60 * 1000);
	if (cached) return cached;

	const [leaguesByUuid, hierarchyLevelByUuid] = await Promise.all([
		listAllLeaguesForSeason({ seasonUuid: options.seasonUuid, associationUuid: options.associationUuid }),
		listAllLeagueHierarchyLevels({ seasonUuid: options.seasonUuid, associationUuid: options.associationUuid }),
	]);

	const result = Object.fromEntries(
		options.leagueUuids.map((leagueUuid) => {
			const leagueHierarchyUuid = leaguesByUuid.get(leagueUuid)?.leagueHierarchyUuid;
			const level = leagueHierarchyUuid ? hierarchyLevelByUuid.get(leagueHierarchyUuid) : undefined;
			return [leagueUuid, level ?? null] as const;
		}),
	);

	await writeSamsCacheEntry(cacheKey, result);
	return result;
}

async function fetchSamsRankingsByLeagueUuid(leagueUuid: string): Promise<RankingResponse> {
	const cacheKey = createCacheKey({ type: "sams_rankings", leagueUuid });
	const cached = await readSamsCacheEntry<RankingResponse>(cacheKey, 5 * 60 * 1000);
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

	await writeSamsCacheEntry(cacheKey, result);
	return result;
}

// ── SAMS API proxy — Matches ─────────────────────────────────────────────────

export const getSamsMatchesFn = createServerFn()
	.inputValidator(
		z
			.object({
				league: z.string().optional(),
				season: z.string().optional(),
				sportsclub: z.string().optional(),
				team: z.string().optional(),
				limit: z.number().int().positive().optional(),
				range: z.enum(["past", "future"]).optional(),
			})
			.optional(),
	)
	.handler(async ({ data }) => {
		let { league, season, sportsclub, team } = data || {};

		// Default to own club if no filter provided
		if (!sportsclub && !team && !league) {
			try {
				const clubSlug = slugify(Club.shortName);
				const club = await getSamsClubByNameSlug(clubSlug);
				if (club?.sportsclubUuid) sportsclub = club.sportsclubUuid as string;
			} catch {
				// proceed without filter
			}
		}

		// Build cache key from the resolved (effective) params so callers that rely on
		// the default sportsclub filter get the same cache entry as explicit callers.
		const cacheKey = createCacheKey({ type: "sams_matches", league, season, sportsclub, team, limit: data?.limit, range: data?.range });
		const cachedMatches = await readSamsCacheEntry<LeagueMatchesResponse>(cacheKey, 5 * 60 * 1000);
		if (cachedMatches) return cachedMatches;

		const defaultQueryParams: Record<string, string> = {};
		if (league) defaultQueryParams["for-league"] = league;
		if (season) defaultQueryParams["for-season"] = season;
		if (sportsclub) defaultQueryParams["for-sportsclub"] = sportsclub;
		if (team) defaultQueryParams["for-team"] = team;

		const allMatches: Omit<LeagueMatchDto, "_links">[] = [];
		let currentPage = 0;
		let hasMorePages = true;
		while (hasMorePages) {
			const { data: pageData } = await getAllLeagueMatches({
				query: { ...defaultQueryParams, page: currentPage, size: 100 },
				signal: AbortSignal.timeout(SAMS_API_TIMEOUT_MS),
			});
			if (!pageData) {
				if (currentPage === 0) throw new Error(`SAMS API returned no data on page ${currentPage}`);
				// Subsequent page returned nothing — return what we have so far
				break;
			}
			if (pageData.content) {
				allMatches.push(...pageData.content.map(({ _links: _, ...m }) => m));
				currentPage++;
			}
			if (pageData.last === true) hasMorePages = false;
		}

		let filteredMatches = allMatches;
		if (data?.range === "future") {
			filteredMatches = allMatches.filter((m) => !m.results?.winner);
			filteredMatches.sort((a, b) => (!a.date ? 1 : !b.date ? -1 : dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1));
		} else if (data?.range === "past") {
			filteredMatches = allMatches.filter((m) => !!m.results?.winner);
			filteredMatches.sort((a, b) => (!a.date ? 1 : !b.date ? -1 : dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1));
		}

		if (data?.limit) filteredMatches = filteredMatches.slice(0, data.limit);

		const result = parseServerData(LeagueMatchesResponseSchema, { matches: filteredMatches, timestamp: new Date().toISOString() }, "Failed to parse SAMS matches response");
		await writeSamsCacheEntry(cacheKey, result);
		return result;
	});

// ── SAMS API proxy — Rankings ────────────────────────────────────────────────

export const getSamsRankingsByLeagueUuidsFn = createServerFn()
	.inputValidator(z.object({ leagueUuids: z.array(z.string()) }))
	.handler(async ({ data }) => {
		return Promise.all(data.leagueUuids.map((leagueUuid) => fetchSamsRankingsByLeagueUuid(leagueUuid)));
	});

/**
 * Cache-peek-only variant: reads from DynamoDB without falling back to the SAMS API.
 * Returns cached rankings if all leagues are cached, otherwise null.
 * Use in route loaders to keep navigation fast — React Query will fetch live data client-side.
 */
export const peekSamsRankingsByLeagueUuidsFn = createServerFn()
	.inputValidator(z.object({ leagueUuids: z.array(z.string()) }))
	.handler(async ({ data }) => {
		const results = await Promise.all(
			data.leagueUuids.map((leagueUuid) => {
				const cacheKey = createCacheKey({ type: "sams_rankings", leagueUuid });
				return readSamsCacheEntry<RankingResponse>(cacheKey, 5 * 60 * 1000);
			}),
		);
		if (results.some((r) => r === null)) return null;
		return results as RankingResponse[];
	});

/**
 * Cache-peek-only variant for matches: resolves the effective filter params (including the
 * default sportsclub UUID) and returns the cached entry if present, otherwise null.
 * Use in route loaders to keep navigation fast — React Query will fetch live data client-side.
 */
export const peekSamsMatchesCacheFn = createServerFn()
	.inputValidator(
		z
			.object({
				league: z.string().optional(),
				season: z.string().optional(),
				sportsclub: z.string().optional(),
				team: z.string().optional(),
				limit: z.number().int().positive().optional(),
				range: z.enum(["past", "future"]).optional(),
			})
			.optional(),
	)
	.handler(async ({ data }) => {
		let { league, season, sportsclub, team } = data || {};

		// Mirror the default sportsclub resolution from getSamsMatchesFn so the cache key matches.
		if (!sportsclub && !team && !league) {
			try {
				const clubSlug = slugify(Club.shortName);
				const club = await getSamsClubByNameSlug(clubSlug);
				if (club?.sportsclubUuid) sportsclub = club.sportsclubUuid as string;
			} catch {
				// proceed without filter
			}
		}

		const cacheKey = createCacheKey({ type: "sams_matches", league, season, sportsclub, team, limit: data?.limit, range: data?.range });
		return readSamsCacheEntry<LeagueMatchesResponse>(cacheKey, 5 * 60 * 1000);
	});

export const getSamsLeagueLevelsByLeagueUuidsFn = createServerFn()
	.inputValidator(
		z.object({
			leagueUuids: z.array(z.string()),
			seasonUuid: z.string().optional(),
			associationUuid: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		return fetchLeagueLevelsByLeagueUuid({
			leagueUuids: data.leagueUuids,
			seasonUuid: data.seasonUuid,
			associationUuid: data.associationUuid,
		});
	});

export const listSamsClubsFn = createServerFn().handler(async () => {
	const result = await getAllSamsClubs();
	return {
		items: result.items,
		clubs: result.items,
		lastEvaluatedKey: result.lastEvaluatedKey,
	};
});

export const listSamsTeamsFn = createServerFn().handler(async () => {
	const result = await getAllSamsTeams();
	return {
		items: result.items,
		teams: result.items,
		lastEvaluatedKey: result.lastEvaluatedKey,
	};
});

export const getClubLogoUrlFn = createServerFn()
	.inputValidator(z.union([z.object({ clubUuid: z.string().min(1), clubSlug: z.undefined().optional() }), z.object({ clubSlug: z.string().min(1), clubUuid: z.undefined().optional() })]))
	.handler(async ({ data }) => {
		const club = data.clubUuid ? await getSamsClubBySportsclubUuid(data.clubUuid) : data.clubSlug ? await getSamsClubByNameSlug(data.clubSlug) : null;
		return resolveClubLogoUrl(club, CLOUDFRONT_URL());
	});

export const getClubLogoUrlsBatchFn = createServerFn()
	.inputValidator(z.object({ clubSlugs: z.array(z.string().min(1)) }))
	.handler(async ({ data }) => {
		const cfUrl = CLOUDFRONT_URL();
		const entries = await Promise.all(
			data.clubSlugs.map(async (slug) => {
				const club = (await getSamsClubByNameSlug(slug)) ?? (await getSamsClubByNameSlugPrefix(slug));
				return [slug, resolveClubLogoUrl(club, cfUrl)] as const;
			}),
		);
		return Object.fromEntries(entries) as Record<string, string | null>;
	});

/** Pure helper — resolves a club's effective logo URL from a club record.
 * Exported for unit testing. */
export function resolveClubLogoUrl(club: { logoS3Key?: string | null; logoImageLink?: string | null } | null, cloudfrontUrl: string): string | null {
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
	const matchTeamMap = new Map<string, { team1Uuid: string; team2Uuid: string; team1Name: string; team2Name: string; matchDate?: string | number }>();
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
		if (!teams.matchDate || !dayjs(teams.matchDate).isValid() || !dayjs(teams.matchDate).isSame(today, "day")) continue;
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

export const getSamsTickerFn = createServerFn().handler(async () => {
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

			const raw = parseServerData(RawTickerResponseSchema, await response.json(), "Failed to parse SAMS ticker response");
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
});
