import { createQueryClient, getApiUrl, getAuthorizationHeader, getWebsiteApiConfig } from "@apps/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { type ReactNode, useState } from "react";
import superjson from "superjson";
import { trpc } from "./trpc";

const API_URL = getApiUrl(getWebsiteApiConfig());

export function TRPCProvider({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => createQueryClient());

	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: API_URL,
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
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</trpc.Provider>
	);
}
