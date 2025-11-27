/**
 * Custom hooks for common data fetching patterns
 * These are type-safe wrappers around tRPC queries
 */

import { trpc } from "./trpc";

/**
 * Hook to fetch all published news articles
 */
export const useNews = () => {
	return trpc.news.published.useQuery();
};

/**
 * Hook to fetch a single news article by slug
 */
export const useNewsBySlug = (slug: string) => {
	return trpc.news.getBySlug.useQuery({ slug }, { enabled: !!slug });
};

/**
 * Hook to fetch all upcoming events
 */
export const useEvents = () => {
	return trpc.events.upcoming.useQuery();
};

/**
 * Hook to fetch a single event by ID
 */
export const useEventById = (id: string) => {
	return trpc.events.getById.useQuery({ id }, { enabled: !!id });
};

/**
 * Hook to fetch all teams
 */
export const useTeams = () => {
	return trpc.teams.list.useQuery();
};

/**
 * Hook to fetch a single team by slug
 */
export const useTeamBySlug = (slug: string) => {
	return trpc.teams.getBySlug.useQuery({ slug }, { enabled: !!slug });
};

/**
 * Hook to fetch all members
 */
export const useMembers = () => {
	return trpc.members.list.useQuery();
};

/**
 * Hook to fetch all sponsors
 */
export const useSponsors = () => {
	return trpc.sponsors.list.useQuery();
};

/**
 * Hook to fetch all locations
 */
export const useLocations = () => {
	return trpc.locations.list.useQuery();
};

/**
 * Hook to fetch media items by IDs
 */
export const useMediaByIds = (ids: string[]) => {
	return trpc.media.getMany.useQuery({ ids }, { enabled: ids.length > 0 });
};

/**
 * Hook to fetch a file URL by S3 key
 */
export const useFileUrl = (s3Key?: string) => {
	return trpc.upload.getFileUrl.useQuery({ s3Key: s3Key || "" }, { enabled: !!s3Key });
};

/**
 * Hook to fetch bus bookings
 */
export const useBusBookings = () => {
	return trpc.bus.list.useQuery();
};
