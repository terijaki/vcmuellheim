/**
 * Custom hooks for data fetching — replaces tRPC hooks and SAMS URL-based hooks.
 * Uses server functions with React Query under the hood.
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { RankingResponse } from "@/lambda/sams/types";
import type { PaginationCursor } from "@/lib/db/types";
import type { SamsMatchesHookOptions } from "@webapp/utils/sams-ssr";
import { SAMS_MATCHES_CACHE_TTL_MS } from "@utils/sams-api";
import { getEventByIdFn, getUpcomingEventsFn } from "../server/functions/events";
import { listLocationsFn } from "../server/functions/locations";
import { getHomeMembersFn } from "../server/functions/members";

// Server functions
import {
  getGalleryImagesFn,
  getHomeNewsFn,
  getNewsByIdFn,
  getPublishedNewsFn,
} from "../server/functions/news";
import {
  getHomeHeimspieleFn,
  getSamsMatchesFn,
  getSamsRankingByLeagueUuidFn,
  getSamsRosterByTeamUuidFn,
  getSamsTickerFn,
  listSamsTeamsFn,
} from "../server/functions/sams";
import { listPublicSponsorsFn } from "../server/functions/sponsors";
import { getTeamBySlugFn, listTeamsFn } from "../server/functions/teams";
import { getFileUrlFn, getFileUrlsFn } from "../server/functions/upload";

// ============================================================================
// News
// ============================================================================

export const useHomeNews = (options?: {
  initialData?: Awaited<ReturnType<typeof getHomeNewsFn>>;
}) => {
  return useQuery({
    queryKey: ["homeNews"],
    queryFn: () => getHomeNewsFn(),
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
  });
};

export const useNews = ({
  limit = 50,
  initialItems,
}: {
  limit?: number;
  initialItems?: Awaited<ReturnType<typeof getPublishedNewsFn>>["items"];
} = {}) => {
  return useInfiniteQuery({
    queryKey: ["news", limit],
    queryFn: ({ pageParam }) => getPublishedNewsFn({ data: { limit, cursor: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.lastEvaluatedKey,
    initialPageParam: undefined as PaginationCursor | undefined,
    initialData: initialItems
      ? {
          pages: [{ items: initialItems, lastEvaluatedKey: undefined }],
          pageParams: [undefined],
        }
      : undefined,
    initialDataUpdatedAt: initialItems ? Date.now() : undefined,
  });
};

export const useNewsById = (id: string) => {
  return useQuery({
    queryKey: ["news", "id", id],
    queryFn: () => getNewsByIdFn({ data: { id } }),
    enabled: !!id && z.uuid().safeParse(id).success,
  });
};

export const useGalleryImages = ({
  limit = 20,
  format = "urls",
  shuffle,
}: { limit?: number; format?: "urls" | "keys"; shuffle?: boolean } = {}) => {
  return useInfiniteQuery({
    queryKey: ["galleryImages", limit, format, shuffle],
    queryFn: ({ pageParam }) =>
      getGalleryImagesFn({ data: { limit, format, shuffle, cursor: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as PaginationCursor | undefined,
  });
};

// ============================================================================
// Events
// ============================================================================

export const useEvents = (options?: {
  initialData?: Awaited<ReturnType<typeof getUpcomingEventsFn>>;
}) => {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => getUpcomingEventsFn(),
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
  });
};

export const useEventById = (id: string) => {
  return useQuery({
    queryKey: ["events", "id", id],
    queryFn: () => getEventByIdFn({ data: { id } }),
    enabled: !!id && z.uuid().safeParse(id).success,
  });
};

// ============================================================================
// Teams
// ============================================================================

export const useTeams = (options?: {
  enabled?: boolean;
  initialData?: Awaited<ReturnType<typeof listTeamsFn>>;
}) => {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => listTeamsFn(),
    enabled: options?.enabled ?? true,
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
  });
};

export const useTeamBySlug = (
  slug: string,
  initialData?: Awaited<ReturnType<typeof getTeamBySlugFn>>,
) => {
  return useQuery({
    queryKey: ["teams", "slug", slug],
    queryFn: () => getTeamBySlugFn({ data: { slug } }),
    enabled: !!slug,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
};

// ============================================================================
// Members
// ============================================================================

export const useMembers = (options?: {
  initialData?: Awaited<ReturnType<typeof getHomeMembersFn>>;
}) => {
  return useQuery({
    queryKey: ["homeMembers"],
    queryFn: () => getHomeMembersFn(),
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
  });
};

// ============================================================================
// Sponsors
// ============================================================================

export const useSponsors = (options?: {
  initialData?: Awaited<ReturnType<typeof listPublicSponsorsFn>>;
}) => {
  return useQuery({
    queryKey: ["sponsors", "public"],
    queryFn: () => listPublicSponsorsFn(),
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
  });
};

export const useHomeHeimspiele = (options?: {
  initialData?: Awaited<ReturnType<typeof getHomeHeimspieleFn>>;
}) => {
  return useQuery({
    queryKey: ["homeHeimspiele"],
    queryFn: () => getHomeHeimspieleFn(),
    staleTime: SAMS_MATCHES_CACHE_TTL_MS,
    refetchOnWindowFocus: false,
    initialData: options?.initialData,
    initialDataUpdatedAt: options?.initialData ? Date.now() : undefined,
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
// SAMS
// ============================================================================

export const useSamsTeams = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["samsTeams"],
    queryFn: () => listSamsTeamsFn(),
    enabled: options?.enabled ?? true,
  });
};

export const useSamsRoster = (teamUuid?: string) => {
  return useQuery({
    queryKey: ["samsRoster", teamUuid],
    queryFn: () => getSamsRosterByTeamUuidFn({ data: teamUuid as string }),
    enabled: !!teamUuid,
  });
};

export const samsRankingQuery = (
  leagueUuid: string,
  options?: { initialData?: RankingResponse; initialDataUpdatedAt?: number },
) => ({
  queryKey: ["samsRanking", leagueUuid] as const,
  queryFn: () => getSamsRankingByLeagueUuidFn({ data: leagueUuid }),
  enabled: !!leagueUuid,
  staleTime: 1000 * 60 * 10,
  retry: 1 as const,
  placeholderData: (previousData: RankingResponse | undefined) => previousData,
  refetchOnWindowFocus: false as const,
  initialData: options?.initialData,
  initialDataUpdatedAt: options?.initialDataUpdatedAt,
});

export const useSamsMatches = ({
  league,
  season,
  sportsclub,
  team,
  limit,
  range,
  homeOnly,
  initialData,
  initialDataUpdatedAt,
}: SamsMatchesHookOptions = {}) => {
  return useQuery({
    queryKey: ["samsMatches", league, season, sportsclub, team, limit, range, homeOnly],
    queryFn: () =>
      getSamsMatchesFn({ data: { league, season, sportsclub, team, limit, range, homeOnly } }),
    retry: 1,
    staleTime: SAMS_MATCHES_CACHE_TTL_MS,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    initialData,
    initialDataUpdatedAt,
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
