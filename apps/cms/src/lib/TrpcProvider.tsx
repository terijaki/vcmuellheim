import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, useRef, useState } from "react";
import superjson from "superjson";
import type { AppRouter } from "@/lib/trpc";
import { createQueryClient, getApiUrl } from "../../../shared";
import { TRPCProvider } from "../../../shared/lib/trpc-config";
import { useAuth } from "../auth/AuthContext";

export function TrpcProvider({ children }: { children: ReactNode }) {
	const { idToken } = useAuth();
	const tokenRef = useRef(idToken);

	// Update ref whenever token changes
	tokenRef.current = idToken;

	const [queryClient] = useState(() => createQueryClient());
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				httpBatchLink({
					url: getApiUrl(),
					transformer: superjson,
					headers() {
						return tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {};
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
