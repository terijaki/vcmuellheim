/**
 * tRPC initialization and base procedures
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { verifyJwt } from "./context";

const t = initTRPC.context<Context>().create({
	transformer: superjson, // Enables Date, Map, Set serialization
});

/** Public (unauthenticated) procedure */
export const publicProcedure = t.procedure;

/** Protected (authenticated) procedure - requires Cognito auth */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	// Verify token when accessing protected routes

	if (!ctx.authorizationHeader || !ctx.userPoolId || !ctx.region) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing authentication" });
	}

	const token = ctx.authorizationHeader.replace(/^Bearer /i, "");
	if (!token) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid authorization header" });
	}

	// Verify JWT - this is where Cognito JWKS call happens (only for protected routes)
	const payload = await verifyJwt(token, ctx.userPoolId, ctx.region);
	if (!payload) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
	}

	// Extract role from Cognito groups
	const groups = payload["cognito:groups"] || [];
	const userRole = groups.includes("Admin") ? "Admin" : groups.includes("Moderator") ? "Moderator" : undefined;

	return next({
		ctx: {
			...ctx,
			userId: payload.sub,
			userRole,
			userEmail: payload.email,
		},
	});
});

/** Admin-only procedure - requires Admin role */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
	//Verify token when accessing admin routes

	if (!ctx.authorizationHeader || !ctx.userPoolId || !ctx.region) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing authentication" });
	}

	const token = ctx.authorizationHeader.replace(/^Bearer /i, "");
	if (!token) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid authorization header" });
	}

	// Verify JWT - this is where Cognito JWKS call happens (only for admin routes)
	const payload = await verifyJwt(token, ctx.userPoolId, ctx.region);
	if (!payload) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
	}

	// Check for Admin role
	const groups = payload["cognito:groups"] || [];
	if (!groups.includes("Admin")) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
	}

	return next({
		ctx: {
			...ctx,
			userId: payload.sub,
			userRole: "Admin" as const,
			userEmail: payload.email,
		},
	});
});

/** Router creator */
export const router = t.router;

/** Middleware creator */
export const middleware = t.middleware;
