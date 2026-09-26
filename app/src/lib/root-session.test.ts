import { describe, expect, it } from "vite-plus/test";
import type { AdminSessionUser } from "../server/functions/session-utils";
import { adminLayoutGuard } from "./auth-guards";
import { resolveBrowserRootSession } from "./root-session";

const adminSession: AdminSessionUser = {
  id: "u1",
  email: "admin@example.com",
  name: "Admin",
  authRole: "Admin",
};

describe("resolveBrowserRootSession", () => {
  it("lets a just-signed-in admin open /admin/members when document.cookie is empty", async () => {
    // Session cookies are httpOnly, so the document cookie string stays empty
    // after email OTP. The server function still receives them.
    const { session } = await resolveBrowserRootSession(async () => adminSession);

    expect(adminLayoutGuard(session, "/admin/members").user.id).toBe("u1");
  });

  it("keeps an anonymous visitor out of /admin", async () => {
    const { session } = await resolveBrowserRootSession(async () => null);

    expect(() => adminLayoutGuard(session, "/admin")).toThrow();
  });
});
