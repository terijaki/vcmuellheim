import { describe, expect, it } from "vite-plus/test";
import type { AdminSessionUser } from "../server/functions/session-utils";
import { adminLayoutGuard, loginPageGuard } from "./auth-guards";

const adminSession: AdminSessionUser = {
  id: "u1",
  email: "admin@example.com",
  name: "Admin",
  authRole: "Admin",
};
const moderatorSession: AdminSessionUser = {
  id: "u2",
  email: "mod@example.com",
  name: "Moderator",
  authRole: "Moderator",
};
const _noRoleSession: AdminSessionUser = { id: "u3", email: "norole@example.com" };

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
    expect(result.user.authRole).toBe("Admin");
  });

  it("returns { user } context for a Moderator session", () => {
    const result = adminLayoutGuard(moderatorSession, "/admin/news");
    expect(result.user.authRole).toBe("Moderator");
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
