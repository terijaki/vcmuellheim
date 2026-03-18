import { getCurrentAdminUserFn } from "../server/functions/session";
import { authClient } from "./auth-client";

export interface AdminSessionUser {
	id: string;
	email: string;
	name?: string;
	role?: string;
}

export async function getCurrentAdminUser(): Promise<AdminSessionUser | null> {
	if (import.meta.env.SSR) {
		return getCurrentAdminUserFn();
	}

	const session = await authClient.getSession();
	if (!session.data?.user) {
		return null;
	}

	const user = session.data.user as { id: string; email: string; name?: string | null } & Record<string, unknown>;
	const role = typeof user.role === "string" ? user.role : undefined;

	return {
		id: user.id,
		email: user.email,
		name: user.name ?? undefined,
		role,
	};
}
