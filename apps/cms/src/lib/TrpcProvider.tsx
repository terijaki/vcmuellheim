import { createQueryClient, getApiUrl, getCmsApiConfig } from "@apps/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { type ReactNode, useRef, useState } from "react";
import superjson from "superjson";
import { useAuth } from "../auth/AuthContext";
import { trpc } from "./trpc";

const API_URL = getApiUrl(getCmsApiConfig());

export function TRPCProvider({ children }: { children: ReactNode }) {
	const { idToken } = useAuth();
	const tokenRef = useRef(idToken);

	// Update ref whenever token changes
	tokenRef.current = idToken;

	const [queryClient] = useState(() => createQueryClient());
	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: API_URL,
					transformer: superjson,
					headers() {
						return tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {};
					},
				}),
			],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</trpc.Provider>
	);
}
