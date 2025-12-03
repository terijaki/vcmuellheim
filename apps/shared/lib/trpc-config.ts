import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../../lib/trpc";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

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
		mutationCache: new MutationCache({
			onError: (error) => {
				console.error("Mutation error:", error);
			},
		}),
	});
}

/**
 * Get authorization header from token
 * Returns empty object if no token is provided
 */
export function getAuthorizationHeader(token: string | null | undefined): Record<string, string> {
	return token ? { Authorization: `Bearer ${token}` } : {};
}
