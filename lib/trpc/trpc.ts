/**
 * tRPC initialization and base procedures
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { verifySession } from "./context";

const t = initTRPC.context<Context>().create({
	transformer: superjson, // Enables Date, Map, Set serialization
});

/** Public (unauthenticated) procedure */
export const publicProcedure = t.procedure;

/** Protected (authenticated) procedure - requires valid better-auth session */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.headers) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing authentication" });
	}

	const sessionUser = await verifySession(ctx.headers);
	if (!sessionUser) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired session" });
	}

	return next({
		ctx: {
			...ctx,
			userId: sessionUser.userId,
			userRole: sessionUser.role,
			userEmail: sessionUser.email,
		},
	});
});

/** Admin-only procedure - requires Admin role */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.headers) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing authentication" });
	}

	const sessionUser = await verifySession(ctx.headers);
	if (!sessionUser) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired session" });
	}

	if (sessionUser.role !== "Admin") {
		throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
	}

	return next({
		ctx: {
			...ctx,
			userId: sessionUser.userId,
			userRole: "Admin" as const,
			userEmail: sessionUser.email,
		},
	});
});

/** Router creator */
export const router = t.router;

/** Middleware creator */
export const middleware = t.middleware;
