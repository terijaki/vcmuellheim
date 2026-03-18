/**
 * Pure, framework-free session utilities.
 * Safe to import in unit tests without triggering TanStack Start / DynamoDB side-effects.
 */

export interface AdminSessionUser {
	id: string;
	email: string;
	name?: string;
	role?: string;
}

/**
 * Maps a raw better-auth user object to AdminSessionUser.
 * Exported for unit testing.
 */
export function mapSessionUser(
	user: { id: string; email: string; name?: string | null } & Record<string, unknown>,
): AdminSessionUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name ?? undefined,
		role: typeof user.role === "string" ? user.role : undefined,
	};
}
