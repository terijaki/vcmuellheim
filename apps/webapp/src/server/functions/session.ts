import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { AdminSessionUser } from "../../lib/admin-session";
import { getAuth } from "../auth";

export const getCurrentAdminUserFn = createServerFn().handler(async (): Promise<AdminSessionUser | null> => {
	const request = getRequest();
	const session = await getAuth().api.getSession({ headers: request.headers });

	if (!session?.user) {
		return null;
	}

	const user = session.user as { id: string; email: string; name?: string | null } & Record<string, unknown>;
	const role = typeof user.role === "string" ? user.role : undefined;

	return {
		id: user.id,
		email: user.email,
		name: user.name ?? undefined,
		role,
	};
});
