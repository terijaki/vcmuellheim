import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, useState } from "react";
import superjson from "superjson";
import type { AppRouter } from "@/lib/trpc";
import { buildServiceUrl, createQueryClient } from "../../../shared";
import { TRPCProvider } from "../../../shared/lib/trpc-config";

export function TrpcProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => createQueryClient(Sentry.captureException));
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				httpBatchLink({
					url: buildServiceUrl("api", "/api"),
					transformer: superjson,
					// Session is provided via httpOnly cookie (better-auth JWE)
					// No manual Authorization header needed — cookies are sent automatically
					fetch(url, options) {
						return fetch(url, { ...options, credentials: "include" });
					},
				}),
			],
		}),
	);

	return (
		<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</TRPCProvider>
	);
}
