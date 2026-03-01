/**
 * tRPC context - available to all procedures
 * LAZY SESSION VERIFICATION: Session verification is deferred to protected procedures for performance
 */

import { Logger } from "@aws-lambda-powertools/logger";
import { auth } from "@/lambda/content/auth";

export type UserRole = "Admin" | "Moderator";

export interface Context {
	// Lazy-loaded: Only populated after session verification in protected procedures
	userId?: string;
	userRole?: UserRole;
	userEmail?: string;

	// Raw request headers for lazy session verification in protected procedures
	headers?: Headers;
}

interface CreateContextOptions {
	headers?: Headers;
}

const logger = new Logger({ serviceName: "vcm-session" });

/**
 * Verify better-auth session from request headers
 * Called lazily only for protected/admin procedures to avoid unnecessary DB calls
 * @param headers Request headers containing session cookie
 * @returns Session user data or null if verification fails
 */
export async function verifySession(headers: Headers): Promise<{ userId: string; email: string; role: UserRole } | null> {
	try {
		const session = await auth.api.getSession({ headers });
		if (!session?.user) {
			return null;
		}

		const role = (session.user as { role?: string }).role as UserRole | undefined;
		if (!role || (role !== "Admin" && role !== "Moderator")) {
			logger.warn("Session user has no valid role", { userId: session.user.id });
			return null;
		}

		logger.debug("Session verification successful");
		return {
			userId: session.user.id,
			email: session.user.email,
			role,
		};
	} catch (error) {
		logger.error("Session verification failed", { error: String(error) });
		return null;
	}
}

export async function createContext(opts: CreateContextOptions = {}): Promise<Context> {
	const { headers } = opts;

	// LAZY SESSION VERIFICATION:
	// Simply return context with raw headers
	// Session verification happens in protectedProcedure/adminProcedure middleware only
	// This saves latency on every public route request that doesn't need auth

	return {
		headers,
		// Unauthenticated by default (no userId)
		userId: undefined,
	};
}
