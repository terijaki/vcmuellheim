/**
 * SAMS server functions — replaces lib/trpc/routers/samsClubs.ts + samsTeams.ts
 * plus the read lambdas from SamsApiStack (matches, rankings).
 * All read-only, public.
 */

import { getAllLeagueMatches, getLeagueByUuid, getRankingsForLeague, getSeasonByUuid, type LeagueMatchDto } from "@codegen/sams/generated";
import { Club } from "@project.config";
import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import dayjs from "dayjs";
import { z } from "zod";
import { LeagueMatchesResponseSchema, type RankingResponse, RankingResponseSchema } from "@/lambda/sams/types";
import { getAllSamsClubs, getAllSamsTeams, getSamsClubByExactSlug, getSamsClubByNameSlug, getSamsClubBySportsclubUuid, getSamsTeamByUuid } from "../queries";

const SAMS_API_KEY = () => process.env.SAMS_API_KEY || "";

async function fetchSamsRankingsByLeagueUuid(leagueUuid: string): Promise<RankingResponse> {
	const apiKey = SAMS_API_KEY();
	if (!apiKey) throw new Error("SAMS API key not configured");

	const { data: rankingsData } = await getRankingsForLeague({
		path: { uuid: leagueUuid },
		query: { page: 0, size: 100 },
		headers: { "X-API-Key": apiKey },
	});

	if (!rankingsData?.content) throw new Error("No rankings found for this league");

	let leagueName: string | undefined;
	let seasonName: string | undefined;

	const { data: leagueData } = await getLeagueByUuid({
		path: { uuid: leagueUuid },
		headers: { "X-API-Key": apiKey },
	});
	if (leagueData?.name) leagueName = leagueData.name;

	if (leagueData?.seasonUuid) {
		const { data: seasonData } = await getSeasonByUuid({
			path: { uuid: leagueData.seasonUuid },
			headers: { "X-API-Key": apiKey },
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
		const apiKey = SAMS_API_KEY();
		if (!apiKey) throw new Error("SAMS API key not configured");

		let { league, season, sportsclub, team } = data || {};

		// Default to own club if no filter provided
		if (!sportsclub && !team && !league) {
			try {
				const clubSlug = slugify(Club.shortName);
				const club = await getSamsClubByExactSlug(clubSlug);
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
				query: { ...defaultQueryParams, page: currentPage },
				headers: { "X-API-Key": apiKey },
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
