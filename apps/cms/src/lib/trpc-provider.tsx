import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { type ReactNode, useRef, useState } from "react";
import superjson from "superjson";
import { useAuth } from "../auth/AuthContext";
import { trpc } from "./trpc";

const API_URL = "https://96emgymync.execute-api.eu-central-1.amazonaws.com/api";

export function TRPCProvider({ children }: { children: ReactNode }) {
	const { idToken } = useAuth();
	const tokenRef = useRef(idToken);

	// Update ref whenever token changes
	tokenRef.current = idToken;

	const [queryClient] = useState(() => new QueryClient());
	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: API_URL,
					transformer: superjson,
					headers() {
						return tokenRef.current
							? {
									Authorization: `Bearer ${tokenRef.current}`,
								}
							: {};
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
