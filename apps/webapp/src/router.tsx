import { Sentry as SentryConfig } from "@project.config";
import * as Sentry from "@sentry/tanstackstart-react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { AdminSessionUser } from "./server/functions/session-utils";

export interface RouterContext {
	queryClient: QueryClient;
	/** Session resolved by the root beforeLoad; null when unauthenticated. */
	session: AdminSessionUser | null;
}

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1000 * 60 * 5,
				gcTime: 1000 * 60 * 10,
				retry: 2,
			},
		},
	});
	const router = createTanStackRouter({
		routeTree,
		context: { queryClient, session: null },
		defaultPreload: "intent",
		scrollRestoration: true,
	});

	if (!router.isServer && !Sentry.getClient()) {
		Sentry.init({
			dsn: SentryConfig.dsn,
			enabled: Boolean(SentryConfig.dsn),
			environment: import.meta.env.VITE_CDK_ENVIRONMENT || import.meta.env.MODE || "development",
			sendDefaultPii: true,
		});
	}

	return router;
}

export const createRouter = getRouter;

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
