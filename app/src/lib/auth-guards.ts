import { redirect } from "@tanstack/react-router";
import type { AdminSessionUser } from "../server/functions/session-utils";

/**
 * Guards access to the /admin layout.
 * Redirects unauthenticated visitors to /admin/login, preserving the
 * intended destination in the `redirect` search parameter.
 */
export function adminLayoutGuard(session: AdminSessionUser | null, href: string): { user: AdminSessionUser } {
	if (!session) {
		throw redirect({
			to: "/admin/login",
			search: { redirect: href },
			replace: true,
		});
	}
	return { user: session };
}

/**
 * Guards the /admin/login and /admin/otp-login pages.
 * Redirects already-authenticated users to /admin.
 */
export function loginPageGuard(session: AdminSessionUser | null): void {
	if (session) {
		throw redirect({ to: "/admin", replace: true });
	}
}

/**
 * Guards the /admin/users page.
 * Only the "Admin" role may manage users; all others are sent back to /admin.
 */
export function adminUsersGuard(user: AdminSessionUser): { currentUser: AdminSessionUser } {
	if (user.role !== "Admin") {
		throw redirect({ to: "/admin", replace: true });
	}
	return { currentUser: user };
}
