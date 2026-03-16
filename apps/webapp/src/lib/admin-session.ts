import { authClient } from "./auth-client";

export interface AdminSessionUser {
	id: string;
	email: string;
	name?: string;
	role?: string;
}

export async function getCurrentAdminUser(): Promise<AdminSessionUser | null> {
	if (import.meta.env.SSR) {
		const [{ getRequest }, { getAuth }] = await Promise.all([import("@tanstack/react-start/server"), import("../server/auth")]);
		const request = getRequest();
		const session = await getAuth().api.getSession({ headers: request.headers });

		if (!session?.user) {
			return null;
		}

		return toAdminSessionUser(session.user);
	}

	const session = await authClient.getSession();
	if (!session.data?.user) {
		return null;
	}

	return toAdminSessionUser(session.data.user);
}

function toAdminSessionUser(user: { id: string; email: string; name?: string | null } & Record<string, unknown>): AdminSessionUser {
	const role = typeof user.role === "string" ? user.role : undefined;

	return {
		id: user.id,
		email: user.email,
		name: user.name ?? undefined,
		role,
	};
}
