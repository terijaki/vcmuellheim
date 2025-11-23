import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { type ReactNode, useRef, useState } from "react";
import superjson from "superjson";
import { useAuth } from "../auth/AuthContext";
import { trpc } from "./trpc";

// Compute API URL based on current hostname
// Examples:
// - dev-aws-migration-admin.new.vcmuellheim.de -> dev-aws-migration-api.new.vcmuellheim.de
// - dev-admin.new.vcmuellheim.de -> dev-api.new.vcmuellheim.de
// - admin.new.vcmuellheim.de -> api.new.vcmuellheim.de
// - localhost -> computed from VITE_CDK_ENVIRONMENT and Git branch (injected at build time)
function getApiUrl(): string {
	if (typeof window === "undefined") return "";

	const hostname = window.location.hostname;

	// Local development: compute URL from environment and Git branch
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		const environment = import.meta.env.VITE_CDK_ENVIRONMENT || "dev";
		const gitBranch = import.meta.env.VITE_GIT_BRANCH || ""; // Injected at build time from Git
		const isProd = environment === "prod";
		const isMainBranch = gitBranch === "main" || gitBranch === "";
		const branch = !isMainBranch ? gitBranch : "";
		const branchSuffix = branch ? `-${branch}` : "";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		return `https://${envPrefix}api.new.vcmuellheim.de/api`;
	}

	// Production/staging: replace admin -> api in hostname
	const apiHostname = hostname.replace("-admin.", "-api.").replace("admin.", "api.");
	return `https://${apiHostname}/api`;
}

const API_URL = getApiUrl();

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
