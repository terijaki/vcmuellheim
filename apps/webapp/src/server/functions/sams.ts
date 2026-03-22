/**
 * SAMS server functions — replaces lib/trpc/routers/samsClubs.ts + samsTeams.ts
 * plus the read lambdas from SamsApiStack (matches, rankings).
 * All read-only, public.
 */

import { getAllLeagueHierarchies, getAllLeagueMatches, getAllLeagues, getLeagueByUuid, getRankingsForLeague, getSeasonByUuid, type LeagueMatchDto } from "@codegen/sams/generated";
import { Club } from "@project.config";
import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import dayjs from "dayjs";
import { z } from "zod";
import { LeagueMatchesResponseSchema, type RankingResponse, RankingResponseSchema } from "@/lambda/sams/types";
import { getAllSamsClubs, getAllSamsTeams, getSamsClubByNameSlug, getSamsClubByNameSlugPrefix, getSamsClubBySportsclubUuid, getSamsTeamByUuid } from "../queries";

const CLOUDFRONT_URL = () => process.env.CLOUDFRONT_URL || "";

const SAMS_API_TIMEOUT_MS = 10_000;
const LEAGUE_METADATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

type LeagueHierarchyLevelsCacheValue = {
	leagueLevelsByLeagueUuid: Record<string, number | null>;
	expiresAt: number;
};

const leagueHierarchyLevelsCache = new Map<string, LeagueHierarchyLevelsCacheValue>();

function toCacheKey(input: { leagueUuids: string[]; seasonUuid?: string; associationUuid?: string }) {
	const sortedLeagueUuids = [...new Set(input.leagueUuids)].sort();
	const season = input.seasonUuid ?? "";
	const association = input.associationUuid ?? "";
	return `${season}::${association}::${sortedLeagueUuids.join(",")}`;
}

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
	const cacheKey = toCacheKey(options);
	const now = Date.now();
	const cached = leagueHierarchyLevelsCache.get(cacheKey);
	if (cached && cached.expiresAt > now) {
		return cached.leagueLevelsByLeagueUuid;
	}

	const [leaguesByUuid, hierarchyLevelByUuid] = await Promise.all([
		listAllLeaguesForSeason({ seasonUuid: options.seasonUuid, associationUuid: options.associationUuid }),
		listAllLeagueHierarchyLevels({ seasonUuid: options.seasonUuid, associationUuid: options.associationUuid }),
	]);

	const leagueLevelsByLeagueUuid = Object.fromEntries(
		options.leagueUuids.map((leagueUuid) => {
			const leagueHierarchyUuid = leaguesByUuid.get(leagueUuid)?.leagueHierarchyUuid;
			const level = leagueHierarchyUuid ? hierarchyLevelByUuid.get(leagueHierarchyUuid) : undefined;
			return [leagueUuid, level ?? null] as const;
		}),
	);

	leagueHierarchyLevelsCache.set(cacheKey, {
		leagueLevelsByLeagueUuid,
		expiresAt: now + LEAGUE_METADATA_CACHE_TTL_MS,
	});

	return leagueLevelsByLeagueUuid;
}

async function fetchSamsRankingsByLeagueUuid(leagueUuid: string): Promise<RankingResponse> {
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

	return RankingResponseSchema.parse({
		teams: rankingsData.content,
		timestamp: new Date().toISOString(),
		leagueUuid,
		leagueName,
		seasonName,
	});
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
			if (!pageData) throw new Error(`SAMS API returned no data on page ${currentPage}`);
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

		return LeagueMatchesResponseSchema.parse({ matches: filteredMatches, timestamp: new Date().toISOString() });
	});

// ── SAMS API proxy — Rankings ────────────────────────────────────────────────

export const getSamsRankingsFn = createServerFn()
	.inputValidator(z.object({ leagueUuid: z.string() }))
	.handler(async ({ data }) => {
		return fetchSamsRankingsByLeagueUuid(data.leagueUuid);
	});

export const getSamsRankingsByLeagueUuidsFn = createServerFn()
	.inputValidator(z.object({ leagueUuids: z.array(z.string()) }))
	.handler(async ({ data }) => {
		return Promise.all(data.leagueUuids.map((leagueUuid) => fetchSamsRankingsByLeagueUuid(leagueUuid)));
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

export const getSamsClubBySportsclubUuidFn = createServerFn()
	.inputValidator(z.object({ sportsclubUuid: z.string() }))
	.handler(async ({ data }) => {
		const club = await getSamsClubBySportsclubUuid(data.sportsclubUuid);
		if (!club) throw new Error("SAMS Club not found");
		return club;
	});

export const getSamsClubByNameSlugFn = createServerFn()
	.inputValidator(z.object({ nameSlug: z.string() }))
	.handler(async ({ data }) => {
		const club = await getSamsClubByNameSlug(data.nameSlug);
		if (!club) throw new Error("SAMS Club not found");
		return club;
	});

export const listSamsTeamsFn = createServerFn().handler(async () => {
	const result = await getAllSamsTeams();
	return {
		items: result.items,
		teams: result.items,
		lastEvaluatedKey: result.lastEvaluatedKey,
	};
});

export const getSamsTeamByUuidFn = createServerFn()
	.inputValidator(z.object({ uuid: z.string() }))
	.handler(async ({ data }) => {
		const team = await getSamsTeamByUuid(data.uuid);
		if (!team) throw new Error("SAMS Team not found");
		return team;
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

export const getClubLogoUrlsByClubUuidBatchFn = createServerFn()
	.inputValidator(z.object({ clubUuids: z.array(z.string().min(1)) }))
	.handler(async ({ data }) => {
		const cfUrl = CLOUDFRONT_URL();
		const uniqueClubUuids = [...new Set(data.clubUuids)];
		const entries = await Promise.all(
			uniqueClubUuids.map(async (clubUuid) => {
				const club = await getSamsClubBySportsclubUuid(clubUuid);
				return [clubUuid, resolveClubLogoUrl(club, cfUrl)] as const;
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
