import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import superjson from "superjson";
import type { AppRouter } from "@/lib/trpc";
import { buildServiceUrl, createQueryClient } from "../../../shared";
import { TRPCProvider } from "../../../shared/lib/trpc-config";
import { useAuth } from "../auth/AuthContext";

export function TrpcProvider({ children }: { children: ReactNode }) {
	const { idToken } = useAuth();
	const tokenRef = useRef(idToken);
	const previousTokenRef = useRef(idToken);

	// Update ref whenever token changes
	tokenRef.current = idToken;

	const [queryClient] = useState(() => createQueryClient());
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				httpBatchLink({
					url: buildServiceUrl("api", "/api"),
					transformer: superjson,
					headers() {
						return tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {};
					},
				}),
			],
		}),
	);

	// Invalidate all queries when token changes (e.g., after refresh or login)
	useEffect(() => {
		if (idToken && idToken !== previousTokenRef.current) {
			console.log("Token changed, invalidating all queries");
			queryClient.invalidateQueries();
			previousTokenRef.current = idToken;
		}
	}, [idToken, queryClient]);

	return (
		<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</TRPCProvider>
	);
}
