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
			userRole: ctx.userRole,
			userEmail: ctx.userEmail,
		},
	});
});

/** Admin-only procedure - requires Admin role */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be logged in" });
	}
	if (ctx.userRole !== "Admin") {
		throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
	}
	return next({
		ctx: {
			...ctx,
			userId: ctx.userId,
			userRole: ctx.userRole as "Admin",
			userEmail: ctx.userEmail,
		},
	});
});

/** Router creator */
export const router = t.router;

/** Middleware creator */
export const middleware = t.middleware;
