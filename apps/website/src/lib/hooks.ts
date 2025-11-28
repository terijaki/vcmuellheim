/**
 * Custom hooks for common data fetching patterns
 * These are type-safe wrappers around tRPC queries
 */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
 * Hook to fetch bus bookings
 */
export const useBusBookings = () => {
	const trpc = useTRPC();
	return useQuery(trpc.bus.list.queryOptions());
};
