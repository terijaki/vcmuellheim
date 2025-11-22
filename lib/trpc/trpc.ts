/**
 * tRPC initialization and base procedures
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
	transformer: superjson, // Enables Date, Map, Set serialization
});

/** Public (unauthenticated) procedure */
export const publicProcedure = t.procedure;

/** Protected (authenticated) procedure - requires Cognito auth */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			...ctx,
			userId: ctx.userId, // TypeScript knows userId is defined here
		},
	});
});

/** Router creator */
export const router = t.router;

/** Middleware creator */
export const middleware = t.middleware;
