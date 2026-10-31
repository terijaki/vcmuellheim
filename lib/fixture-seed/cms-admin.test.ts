import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { grantCmsAdmin } from "./cms-admin";

const memberRepoMocks = vi.hoisted(() => ({
  getByPrivateEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db/repositories/member-repository", () => ({
  memberRepository: memberRepoMocks,
}));

describe("grantCmsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid emails", async () => {
    await expect(grantCmsAdmin(undefined, "not-an-email")).rejects.toThrow();
  });

  it("creates a minimal Admin member when none exists", async () => {
    memberRepoMocks.getByPrivateEmail.mockResolvedValue(null);

    const result = await grantCmsAdmin(undefined, " Admin@Example.com ");

    expect(result).toEqual({ status: "created", email: "admin@example.com" });
    expect(memberRepoMocks.create).toHaveBeenCalledTimes(1);
    expect(memberRepoMocks.update).not.toHaveBeenCalled();
  });

  it("grants Admin to an existing member without authRole", async () => {
    memberRepoMocks.getByPrivateEmail.mockResolvedValue({
      id: "member-1",
      type: "member",
      name: "Admin",
      privateEmail: "admin@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await grantCmsAdmin(undefined, "admin@example.com");

    expect(result).toEqual({ status: "updated", email: "admin@example.com" });
    expect(memberRepoMocks.update).toHaveBeenCalledWith(
      "member-1",
      expect.objectContaining({ authRole: "Admin" }),
    );
    expect(memberRepoMocks.create).not.toHaveBeenCalled();
  });

  it("leaves existing Admin/Moderator roles unchanged", async () => {
    memberRepoMocks.getByPrivateEmail.mockResolvedValue({
      id: "member-1",
      type: "member",
      name: "Mod",
      privateEmail: "admin@example.com",
      authRole: "Moderator",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await grantCmsAdmin(undefined, "admin@example.com");

    expect(result).toEqual({
      status: "unchanged",
      email: "admin@example.com",
      authRole: "Moderator",
    });
    expect(memberRepoMocks.create).not.toHaveBeenCalled();
    expect(memberRepoMocks.update).not.toHaveBeenCalled();
  });
});
