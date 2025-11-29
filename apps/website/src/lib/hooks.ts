/**
 * Custom hooks for common data fetching patterns
 * These are type-safe wrappers around tRPC queries
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getSamsApiUrl } from "@/apps/shared/lib/api-url";
import { ClubResponseSchema, ClubsResponseSchema, LeagueMatchesResponseSchema, type RankingResponse, RankingResponseSchema, TeamsResponseSchema } from "@/lambda/sams/types";
import { useTRPC } from "../../../shared/lib/trpc-config";

/**
 * Infinite query hook for published news articles
 */
export const useNews = ({ limit = 50 }: { limit?: number }) => {
	const trpc = useTRPC();
	return useInfiniteQuery(
		trpc.news.published.infiniteQueryOptions(
			{ limit },
			{
				getNextPageParam: (lastPage) => lastPage.lastEvaluatedKey,
			},
		),
	);
};

/**
 * Hook to fetch a single news article by ID
 */
export const useNewsById = (id: string) => {
	const trpc = useTRPC();
	return useQuery(trpc.news.getById.queryOptions({ id }, { enabled: !!id }));
};
/**
 * Hook to fetch a single news article by slug
 */
export const useNewsBySlug = (slug: string) => {
	const trpc = useTRPC();
	return useQuery(trpc.news.getBySlug.queryOptions({ slug }, { enabled: !!slug }));
};

/**
 * Hook to fetch all upcoming events
 */
export const useEvents = () => {
	const trpc = useTRPC();
	return useQuery(trpc.events.upcoming.queryOptions());
};

/**
 * Hook to fetch a single event by ID
 */
export const useEventById = (id: string) => {
	const trpc = useTRPC();
	return useQuery(trpc.events.getById.queryOptions({ id }, { enabled: !!id }));
};

/**
 * Hook to fetch all teams
 */
export const useTeams = () => {
	const trpc = useTRPC();
	return useQuery(trpc.teams.list.queryOptions());
};

/**
 * Hook to fetch a single team by slug
 */
export const useTeamBySlug = (slug: string) => {
	const trpc = useTRPC();
	return useQuery(trpc.teams.getBySlug.queryOptions({ slug }, { enabled: !!slug }));
};

/**
 * Hook to fetch all members
 */
export const useMembers = () => {
	const trpc = useTRPC();
	return useQuery(trpc.members.list.queryOptions());
};

/**
 * Hook to fetch all sponsors
 */
export const useSponsors = () => {
	const trpc = useTRPC();
	return useQuery(trpc.sponsors.list.queryOptions());
};

/**
 * Hook to fetch all locations
 */
export const useLocations = () => {
	const trpc = useTRPC();
	return useQuery(trpc.locations.list.queryOptions());
};

/**
 * Hook to fetch media items by IDs
 */
export const useMediaByIds = (ids: string[]) => {
	const trpc = useTRPC();
	return useQuery(trpc.media.getMany.queryOptions({ ids }, { enabled: ids.length > 0 }));
};

/**
 * Hook to fetch a file URL by S3 key
 */
export const useFileUrl = (s3Key?: string) => {
	const trpc = useTRPC();
	return useQuery(trpc.upload.getFileUrl.queryOptions({ s3Key: s3Key || "" }, { enabled: !!s3Key }));
};
/**
 * Hook to fetch a file URL by S3 key
 */
export const useFileUrls = (s3Keys?: string[]) => {
	const trpc = useTRPC();
	return useQuery(trpc.upload.getFileUrls.queryOptions({ s3Keys }, { enabled: s3Keys && s3Keys.length > 0 }));
};
/**
 * Hook to fetch a file URL by S3 key
 */
export const useFileUrlsMap = (s3Keys?: string[]) => {
	const trpc = useTRPC();
	return useQuery(trpc.upload.getFileUrlsMap.queryOptions({ s3Keys }, { enabled: s3Keys && s3Keys.length > 0 }));
};

/**
 * Hook to fetch bus bookings
 */
export const useBusBookings = () => {
	const trpc = useTRPC();
	return useQuery(trpc.bus.list.queryOptions());
};

/**
 * Hook to fetch SAMS teams
 */
export const useSamsTeams = () => {
	return useQuery({
		queryKey: ["samsTeams"],
		queryFn: async () => {
			const samsApiDomain = getSamsApiUrl();
			const res = await fetch(`${samsApiDomain}/teams`);
			if (!res.ok) {
				throw new Error(`Failed to fetch SAMS teams`);
			}
			const json = await res.json();
			return TeamsResponseSchema.parse(json);
		},
	});
};
/**
 * Hook to fetch SAMS clubs
 */
export const useSamsClubs = () => {
	return useQuery({
		queryKey: ["samsClubs"],
		queryFn: async () => {
			const samsApiDomain = getSamsApiUrl();
			const res = await fetch(`${samsApiDomain}/clubs`);
			if (!res.ok) {
				throw new Error(`Failed to fetch SAMS clubs`);
			}
			const json = await res.json();
			return ClubsResponseSchema.parse(json);
		},
	});
};
/**
 * Hook to fetch SAMS clubs by sportsclub UUID
 */
export const useSamsClubByUuid = (sportsclubUuid?: string) => {
	return useQuery({
		queryKey: ["samsClub", sportsclubUuid],
		queryFn: async () => {
			const samsApiDomain = getSamsApiUrl();
			const res = await fetch(`${samsApiDomain}/clubs/${sportsclubUuid}`);
			if (!res.ok) {
				throw new Error(`Failed to fetch SAMS club by uuid: ${sportsclubUuid}`);
			}
			const json = await res.json();
			return ClubResponseSchema.parse(json);
		},
		enabled: !!sportsclubUuid,
	});
};
/**
 * Hook to fetch SAMS clubs by nameSlug
 */
export const useSamsClubByNameSlug = (nameSlug?: string) => {
	return useQuery({
		queryKey: ["samsClub", nameSlug],
		queryFn: async () => {
			const samsApiDomain = getSamsApiUrl();
			const res = await fetch(`${samsApiDomain}/clubs?name=${nameSlug}`);
			if (!res.ok) {
				throw new Error(`Failed to fetch SAMS club by slug: ${nameSlug}`);
			}
			const json = await res.json();
			return ClubResponseSchema.parse(json);
		},
		enabled: !!nameSlug,
	});
};

/**
 * Hook to fetch multiple SAMS rankings by league UUID
 */
export const useSamsRankingsByLeagueUuid = (leagueUuids: string[]) => {
	return useQuery({
		queryKey: ["samsRankings", leagueUuids],
		queryFn: async () => {
			const samsApiDomain = getSamsApiUrl();
			const results: RankingResponse[] = [];
			for (const leagueUuid of leagueUuids) {
				const res = await fetch(`${samsApiDomain}/rankings/${leagueUuid}`);
				if (!res.ok) {
					throw new Error(`Failed to fetch SAMS rankings for league ${leagueUuid}`);
				}
				const json = await res.json();
				const parsedResult = RankingResponseSchema.parse(json);
				results.push(parsedResult);
			}
			return results;
		},
		enabled: leagueUuids.length > 0,
	});
};

/**
 * Hook to fetch SAMS matches by team UUID
 */
export const useSamsMatches = ({
	league,
	season,
	sportsclub,
	team,
	limit,
	range,
}: {
	league?: string;
	season?: string;
	sportsclub?: string;
	team?: string;
	limit?: number;
	range?: "past" | "future";
}) => {
	return useQuery({
		queryKey: ["samsMatches", league, season, sportsclub, team, limit, range],
		queryFn: async () => {
			const samsApiDomain = getSamsApiUrl();
			const querys: string[] = [];
			if (league) querys.push(`for-league=${league}`);
			if (season) querys.push(`for-season=${season}`);
			if (sportsclub) querys.push(`for-sportsclub=${sportsclub}`);
			if (team) querys.push(`for-team=${team}`);
			if (limit) querys.push(`limit=${limit}`);
			if (range) querys.push(`range=${range}`);
			const queryString = querys.length > 0 ? querys.join("&") : "";
			const res = await fetch(`${samsApiDomain}/matches?${queryString}`);
			if (!res.ok) {
				throw new Error(`Failed to fetch SAMS teams`);
			}
			const json = await res.json();
			return LeagueMatchesResponseSchema.parse(json);
		},
	});
};
