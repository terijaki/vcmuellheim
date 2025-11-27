import { QueryClient } from "@tanstack/react-query";

/**
 * Default QueryClient configuration for tRPC
 * Used by both CMS and website applications
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: 2,
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
			},
		},
	});
}

/**
 * Get authorization header from token
 * Returns empty object if no token is provided
 */
export function getAuthorizationHeader(token: string | null | undefined): Record<string, string> {
	return token ? { Authorization: `Bearer ${token}` } : {};
}
