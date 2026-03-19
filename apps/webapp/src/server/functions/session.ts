import { createServerFn } from "@tanstack/react-start";
import { sessionMiddleware } from "../../middleware";
import type { AdminSessionUser } from "./session-utils";

export type { AdminSessionUser } from "./session-utils";
export { mapSessionUser } from "./session-utils";

export const getSessionFn = createServerFn()
	.middleware([sessionMiddleware])
	.handler(async ({ context }): Promise<AdminSessionUser | null> => {
		if (!context.session) return null;
		return {
			id: context.session.userId,
			email: context.session.userEmail,
			role: context.session.userRole,
		};
	});
