import { describe, expect, it } from "vite-plus/test";
import type { AdminSessionUser } from "../server/functions/session-utils";
import { adminLayoutGuard, adminUsersGuard, loginPageGuard } from "./auth-guards";

const adminSession: AdminSessionUser = { id: "u1", email: "admin@example.com", name: "Admin", role: "Admin" };
const moderatorSession: AdminSessionUser = { id: "u2", email: "mod@example.com", name: "Moderator", role: "Moderator" };
const noRoleSession: AdminSessionUser = { id: "u3", email: "norole@example.com" };

describe("adminLayoutGuard", () => {
	it("throws a redirect for a null session", () => {
		expect(() => adminLayoutGuard(null, "/admin/news")).toThrow();
	});

	it("redirect target is /admin/login and preserves the original href", () => {
		try {
			adminLayoutGuard(null, "/admin/news");
		} catch (e: unknown) {
			const opts = (e as Response & { options: Record<string, unknown> }).options;
			expect(opts.to).toBe("/admin/login");
			expect((opts.search as Record<string, string>).redirect).toBe("/admin/news");
		}
	});

	it("returns { user } context for an authenticated session", () => {
		const result = adminLayoutGuard(adminSession, "/admin");
		expect(result.user.id).toBe("u1");
		expect(result.user.role).toBe("Admin");
	});

	it("returns { user } context for a Moderator session", () => {
		const result = adminLayoutGuard(moderatorSession, "/admin/news");
		expect(result.user.role).toBe("Moderator");
	});
});

describe("loginPageGuard", () => {
	it("throws a redirect to /admin for an authenticated session", () => {
		expect(() => loginPageGuard(adminSession)).toThrow();
	});

	it("redirect target is /admin when already authenticated", () => {
		try {
			loginPageGuard(adminSession);
		} catch (e: unknown) {
			const opts = (e as Response & { options: Record<string, unknown> }).options;
			expect(opts.to).toBe("/admin");
		}
	});

	it("does not throw for a null session", () => {
		expect(() => loginPageGuard(null)).not.toThrow();
	});
});

describe("adminUsersGuard", () => {
	it("throws a redirect for a Moderator role", () => {
		expect(() => adminUsersGuard(moderatorSession)).toThrow();
	});

	it("throws a redirect when role is undefined", () => {
		expect(() => adminUsersGuard(noRoleSession)).toThrow();
	});

	it("redirect target is /admin for insufficient role", () => {
		try {
			adminUsersGuard(moderatorSession);
		} catch (e: unknown) {
			const opts = (e as Response & { options: Record<string, unknown> }).options;
			expect(opts.to).toBe("/admin");
		}
	});

	it("returns { currentUser } context for Admin role", () => {
		const result = adminUsersGuard(adminSession);
		expect(result.currentUser.email).toBe("admin@example.com");
		expect(result.currentUser.role).toBe("Admin");
	});
});
