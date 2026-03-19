/**
 * TanStack Start server function middleware for authentication.
 * Extracts the better-auth session from cookies and makes user info
 * available in server function context.
 *
 * Usage:
 *   import { sessionMiddleware, requireAuthMiddleware, requireAdminMiddleware } from "../middleware";
 *
 *   const myFn = createServerFn()
 *     .middleware([requireAuthMiddleware])
 *     .handler(async ({ context }) => {
 *       context.userId    // string
 *       context.userEmail // string
 *       context.userRole  // "Admin" | "Moderator"
 *     });
 */

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAuth } from "./server/auth";

export type UserRole = "Admin" | "Moderator";

export interface SessionContext {
	userId: string;
	userEmail: string;
	userRole: UserRole;
}

/**
 * Lazily extracts the session. Does NOT throw for unauthenticated requests.
 * Use this in public server functions that optionally need user info.
 */
export const sessionMiddleware = createMiddleware().server(async ({ next }) => {
	const request = getRequest();
	const session = await tryGetSession(request);
	return next({
		context: {
			session: session ?? null,
		},
	});
});

/**
 * Requires an authenticated session.
 * Throws a 401 error if no valid session is present.
 */
export const requireAuthMiddleware = createMiddleware().server(async ({ next }) => {
	const request = getRequest();
	const session = await tryGetSession(request);
	if (!session) {
		throw new Error("Unauthorized: valid session required");
	}
	return next({
		context: session,
	});
});

/**
 * Requires an Admin role.
 * Throws a 401/403 error if not authenticated or not an Admin.
 */
export const requireAdminMiddleware = createMiddleware().server(async ({ next }) => {
	const request = getRequest();
	const session = await tryGetSession(request);
	if (!session) {
		throw new Error("Unauthorized: valid session required");
	}
	if (session.userRole !== "Admin") {
		throw new Error("Forbidden: Admin role required");
	}
	return next({
		context: session,
	});
});

async function tryGetSession(request: Request): Promise<SessionContext | null> {
	try {
		const auth = getAuth();
		const result = await auth.api.getSession({ headers: request.headers });
		if (!result?.user) return null;

		const role = (result.user as { role?: string }).role as UserRole | undefined;
		if (!role || (role !== "Admin" && role !== "Moderator")) return null;

		return {
			userId: result.user.id,
			userEmail: result.user.email,
			userRole: role,
		};
	} catch {
		return null;
	}
}
