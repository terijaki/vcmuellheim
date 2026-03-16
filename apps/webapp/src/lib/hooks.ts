/**
 * Custom hooks for data fetching — replaces tRPC hooks and SAMS URL-based hooks.
 * Uses server functions with React Query under the hood.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { PaginationCursor } from "@/lib/db/repository";
import { listBusFn } from "../server/functions/bus";
import { getEventByIdFn, getUpcomingEventsFn } from "../server/functions/events";
import { listLocationsFn } from "../server/functions/locations";
import { getManyMediaFn } from "../server/functions/media";
import { listMembersFn } from "../server/functions/members";
// Server functions
import { getGalleryImagesFn, getNewsByIdFn, getNewsBySlugFn, getPublishedNewsFn } from "../server/functions/news";
import { getSamsClubByNameSlugFn, getSamsClubBySportsclubUuidFn, getSamsMatchesFn, getSamsRankingsByLeagueUuidsFn, listSamsClubsFn, listSamsTeamsFn } from "../server/functions/sams";
import { getRecentInstagramPostsFn } from "../server/functions/social";
import { listSponsorsFn } from "../server/functions/sponsors";
import { getTeamByIdFn, getTeamBySlugFn, listTeamsFn } from "../server/functions/teams";
import { getFileUrlFn, getFileUrlsFn, getFileUrlsMapFn } from "../server/functions/upload";
import { IMAGE_VARIANTS } from "./image-config";

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

export const useNewsBySlug = (slug: string) => {
	return useQuery({
		queryKey: ["news", "slug", slug],
		queryFn: () => getNewsBySlugFn({ data: { slug } }),
		enabled: !!slug,
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

export const useTeamById = (id: string) => {
	return useQuery({
		queryKey: ["teams", "id", id],
		queryFn: () => getTeamByIdFn({ data: { id } }),
		enabled: !!id,
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
// Bus bookings
// ============================================================================

export const useBusBookings = () => {
	return useQuery({
		queryKey: ["bus"],
		queryFn: () => listBusFn(),
	});
};

// ============================================================================
// Media
// ============================================================================

export const useMediaByIds = (ids: string[]) => {
	return useQuery({
		queryKey: ["media", ids],
		queryFn: () => getManyMediaFn({ data: { ids } }),
		enabled: ids.length > 0,
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

export const useFileUrlsMap = (s3Keys?: string[]) => {
	return useQuery({
		queryKey: ["fileUrlsMap", s3Keys],
		queryFn: () => {
			if (!s3Keys || s3Keys.length === 0) {
				throw new Error("s3Keys are required");
			}

			return getFileUrlsMapFn({ data: { s3Keys } });
		},
		enabled: !!s3Keys && s3Keys.length > 0,
	});
};

// ============================================================================
// Image variants (pure computation, no API call)
// ============================================================================

export const useImageVariants = (baseS3Key?: string) => {
	if (!baseS3Key || baseS3Key.startsWith("http")) {
		return {
			original: undefined,
			sm: undefined,
			md: undefined,
			lg: undefined,
			webp: { sm: undefined, md: undefined, lg: undefined },
		};
	}

	const withoutSuffix = baseS3Key.replace(/-(480w|800w|1200w)(\.[^.]+)?$/i, "");
	const fileExtension = baseS3Key.match(/\.[^.]+$/)?.[0] || ".jpg";
	const folder = baseS3Key.substring(0, baseS3Key.lastIndexOf("/"));
	const filename = withoutSuffix.split("/").pop();

	return {
		original: baseS3Key,
		sm: `${folder}/${filename}-${IMAGE_VARIANTS.sm}w${fileExtension}`,
		md: `${folder}/${filename}-${IMAGE_VARIANTS.md}w${fileExtension}`,
		lg: `${folder}/${filename}-${IMAGE_VARIANTS.lg}w${fileExtension}`,
		webp: {
			sm: `${folder}/${filename}-${IMAGE_VARIANTS.sm}w.webp`,
			md: `${folder}/${filename}-${IMAGE_VARIANTS.md}w.webp`,
			lg: `${folder}/${filename}-${IMAGE_VARIANTS.lg}w.webp`,
		},
	};
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

export const useSamsClubs = () => {
	return useQuery({
		queryKey: ["samsClubs"],
		queryFn: () => listSamsClubsFn(),
	});
};

export const useSamsClubByUuid = (sportsclubUuid?: string) => {
	return useQuery({
		queryKey: ["samsClub", "uuid", sportsclubUuid],
		queryFn: () => {
			if (!sportsclubUuid) {
				throw new Error("sportsclubUuid is required");
			}

			return getSamsClubBySportsclubUuidFn({ data: { sportsclubUuid } });
		},
		enabled: !!sportsclubUuid,
	});
};

export const useSamsClubByNameSlug = (nameSlug?: string) => {
	return useQuery({
		queryKey: ["samsClub", "slug", nameSlug],
		queryFn: () => {
			if (!nameSlug) {
				throw new Error("nameSlug is required");
			}

			return getSamsClubByNameSlugFn({ data: { nameSlug } });
		},
		enabled: !!nameSlug,
	});
};

export const useSamsRankingsByLeagueUuid = (leagueUuids: string[]) => {
	return useQuery({
		queryKey: ["samsRankings", leagueUuids],
		queryFn: () => getSamsRankingsByLeagueUuidsFn({ data: { leagueUuids } }),
		enabled: leagueUuids.length > 0,
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
	});
};
