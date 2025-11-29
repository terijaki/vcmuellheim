import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, useState } from "react";
import superjson from "superjson";
import type { AppRouter } from "@/lib/trpc";
import { buildServiceUrl, createQueryClient, getAuthorizationHeader } from "../../../shared";
import { TRPCProvider } from "../../../shared/lib/trpc-config";

export function TrpcProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => createQueryClient());
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				httpBatchLink({
					url: buildServiceUrl("api", "/api"),
					transformer: superjson,
					headers() {
						const token = localStorage.getItem("id_token");
						return getAuthorizationHeader(token);
					},
				}),
			],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
				{children}
			</TRPCProvider>
		</QueryClientProvider>
	);
}
