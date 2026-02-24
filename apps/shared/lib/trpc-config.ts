import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../../lib/trpc";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

/**
 * Default QueryClient configuration for tRPC
 * Used by both CMS and website applications
 * @param onQueryError - Optional callback invoked on every query error (e.g. Sentry.captureException)
 */
export function createQueryClient(onQueryError?: (error: Error) => void): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: 2,
				staleTime: 1000 * 60 * 5, // 5 minutes
				gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
			},
		},
		queryCache: new QueryCache({
			onError: (error) => {
				console.error("Query error:", error);
				onQueryError?.(error);
			},
		}),
		mutationCache: new MutationCache({
			onError: (error) => {
				console.error("Mutation error:", error);
				onQueryError?.(error);
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
