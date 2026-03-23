/**
 * Custom hooks for data fetching — replaces tRPC hooks and SAMS URL-based hooks.
 * Uses server functions with React Query under the hood.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { PaginationCursor } from "@/lib/db/types";
import { getEventByIdFn, getUpcomingEventsFn } from "../server/functions/events";
import { listLocationsFn } from "../server/functions/locations";
import { listMembersFn } from "../server/functions/members";
// Server functions
import { getGalleryImagesFn, getNewsByIdFn, getPublishedNewsFn } from "../server/functions/news";
import { getClubLogoUrlFn, getClubLogoUrlsBatchFn, getSamsMatchesFn, getSamsRankingsByLeagueUuidsFn, getSamsTickerFn, listSamsTeamsFn } from "../server/functions/sams";
import { getRecentInstagramPostsFn } from "../server/functions/social";
import { listSponsorsFn } from "../server/functions/sponsors";
import { getTeamBySlugFn, listTeamsFn } from "../server/functions/teams";
import { getFileUrlFn, getFileUrlsFn } from "../server/functions/upload";

// ============================================================================
// News
// ============================================================================

export const useNews = ({ limit = 50 }: { limit?: number } = {}) => {
	return useInfiniteQuery({
		queryKey: ["news", limit],
		queryFn: ({ pageParam }) => getPublishedNewsFn({ data: { limit, cursor: pageParam } }),
		getNextPageParam: (lastPage) => lastPage.lastEvaluatedKey,
		initialPageParam: undefined as PaginationCursor | undefined,
	});
};

export const useNewsById = (id: string) => {
	return useQuery({
		queryKey: ["news", "id", id],
		queryFn: () => getNewsByIdFn({ data: { id } }),
		enabled: !!id,
	});
};

export const useGalleryImages = ({ limit = 20, format = "urls", shuffle }: { limit?: number; format?: "urls" | "keys"; shuffle?: boolean } = {}) => {
	return useInfiniteQuery({
		queryKey: ["galleryImages", limit, format, shuffle],
		queryFn: ({ pageParam }) => getGalleryImagesFn({ data: { limit, format, shuffle, cursor: pageParam } }),
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		initialPageParam: undefined as PaginationCursor | undefined,
	});
};

// ============================================================================
// Events
// ============================================================================

export const useEvents = () => {
	return useQuery({
		queryKey: ["events"],
		queryFn: () => getUpcomingEventsFn(),
	});
};

export const useEventById = (id: string) => {
	return useQuery({
		queryKey: ["events", "id", id],
		queryFn: () => getEventByIdFn({ data: { id } }),
		enabled: !!id,
	});
};

// ============================================================================
// Teams
// ============================================================================

export const useTeams = () => {
	return useQuery({
		queryKey: ["teams"],
		queryFn: () => listTeamsFn(),
	});
};

export const useTeamBySlug = (slug: string) => {
	return useQuery({
		queryKey: ["teams", "slug", slug],
		queryFn: () => getTeamBySlugFn({ data: { slug } }),
		enabled: !!slug,
	});
};

// ============================================================================
// Members
// ============================================================================

export const useMembers = () => {
	return useQuery({
		queryKey: ["members"],
		queryFn: () => listMembersFn(),
	});
};

// ============================================================================
// Sponsors
// ============================================================================

export const useSponsors = () => {
	return useQuery({
		queryKey: ["sponsors"],
		queryFn: () => listSponsorsFn(),
	});
};

// ============================================================================
// Locations
// ============================================================================

export const useLocations = () => {
	return useQuery({
		queryKey: ["locations"],
		queryFn: () => listLocationsFn(),
	});
};

// ============================================================================
// File / Upload URLs
// ============================================================================

export const useFileUrl = (s3Key?: string) => {
	return useQuery({
		queryKey: ["fileUrl", s3Key],
		queryFn: () => {
			if (!s3Key) {
				throw new Error("s3Key is required");
			}

			return getFileUrlFn({ data: { s3Key } });
		},
		enabled: !!s3Key,
	});
};

export const useFileUrls = (s3Keys?: string[]) => {
	return useQuery({
		queryKey: ["fileUrls", s3Keys],
		queryFn: () => {
			if (!s3Keys || s3Keys.length === 0) {
				throw new Error("s3Keys are required");
			}

			return getFileUrlsFn({ data: { s3Keys } });
		},
		enabled: !!s3Keys && s3Keys.length > 0,
	});
};

// ============================================================================
// Instagram / Social
// ============================================================================

export const useRecentInstagramPosts = ({ days = 30 }: { days?: number } = {}) => {
	return useQuery({
		queryKey: ["instagramPosts", days],
		queryFn: () => getRecentInstagramPostsFn({ data: { days } }),
		staleTime: 1000 * 60 * 15, // 15 minutes
	});
};

// ============================================================================
// SAMS
// ============================================================================

export const useSamsTeams = () => {
	return useQuery({
		queryKey: ["samsTeams"],
		queryFn: () => listSamsTeamsFn(),
	});
};

export const useClubLogoUrl = ({ clubUuid, clubSlug }: { clubUuid?: string; clubSlug?: string }) => {
	const identifier = clubUuid || clubSlug;
	return useQuery({
		queryKey: ["clubLogoUrl", clubUuid ?? clubSlug],
		queryFn: () => {
			if (clubUuid) return getClubLogoUrlFn({ data: { clubUuid } });
			if (clubSlug) return getClubLogoUrlFn({ data: { clubSlug } });
			throw new Error("Either clubUuid or clubSlug is required");
		},
		enabled: !!identifier,
	});
};

export const useClubLogoUrlsBatch = (clubSlugs: string[]) => {
	return useQuery({
		queryKey: ["clubLogoUrls", clubSlugs],
		queryFn: () => getClubLogoUrlsBatchFn({ data: { clubSlugs } }),
		enabled: clubSlugs.length > 0,
	});
};

export const useSamsRankingsByLeagueUuid = (leagueUuids: string[]) => {
	return useQuery({
		queryKey: ["samsRankings", leagueUuids],
		queryFn: () => getSamsRankingsByLeagueUuidsFn({ data: { leagueUuids } }),
		enabled: leagueUuids.length > 0,
		staleTime: 1000 * 60 * 10,
		retry: 1,
		placeholderData: (previousData) => previousData,
		refetchOnWindowFocus: false,
	});
};

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
} = {}) => {
	return useQuery({
		queryKey: ["samsMatches", league, season, sportsclub, team, limit, range],
		queryFn: () => getSamsMatchesFn({ data: { league, season, sportsclub, team, limit, range } }),
		retry: 1,
		staleTime: 1000 * 60 * 2,
		placeholderData: (previousData) => previousData,
		refetchOnWindowFocus: false,
	});
};

export const useLiveTicker = () => {
	return useQuery({
		queryKey: ["samsLiveTicker"],
		queryFn: () => getSamsTickerFn(),
		refetchInterval: 10_000,
		staleTime: 9_000,
	});
};
