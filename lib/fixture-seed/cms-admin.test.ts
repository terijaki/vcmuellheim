import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { grantCmsAdmin } from "./cms-admin";

const mockQueryGo = vi.fn();
const mockPatchGo = vi.fn();
const mockCreateGo = vi.fn();
const mockPatchSet = vi.fn(() => ({ go: mockPatchGo }));

const db = {
  member: {
    query: {
      byPrivateEmail: () => ({ go: mockQueryGo }),
    },
    patch: () => ({ set: mockPatchSet }),
    create: () => ({ go: mockCreateGo }),
  },
};

describe("grantCmsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchGo.mockResolvedValue({ data: {} });
    mockCreateGo.mockResolvedValue({ data: {} });
  });

  it("rejects invalid emails", async () => {
    await expect(grantCmsAdmin(db as never, "not-an-email")).rejects.toThrow();
  });

  it("creates a minimal Admin member when none exists", async () => {
    mockQueryGo.mockResolvedValue({ data: [] });

    const result = await grantCmsAdmin(db as never, " Admin@Example.com ");

    expect(result).toEqual({ status: "created", email: "admin@example.com" });
    expect(mockCreateGo).toHaveBeenCalledTimes(1);
    expect(mockPatchGo).not.toHaveBeenCalled();
  });

  it("grants Admin to an existing member without authRole", async () => {
    mockQueryGo.mockResolvedValue({
      data: [{ id: "member-1", privateEmail: "admin@example.com" }],
    });

    const result = await grantCmsAdmin(db as never, "admin@example.com");

    expect(result).toEqual({ status: "updated", email: "admin@example.com" });
    expect(mockPatchSet).toHaveBeenCalledWith(expect.objectContaining({ authRole: "Admin" }));
    expect(mockCreateGo).not.toHaveBeenCalled();
  });

  it("leaves existing Admin/Moderator roles unchanged", async () => {
    mockQueryGo.mockResolvedValue({
      data: [{ id: "member-1", privateEmail: "admin@example.com", authRole: "Moderator" }],
    });

    const result = await grantCmsAdmin(db as never, "admin@example.com");

    expect(result).toEqual({
      status: "unchanged",
      email: "admin@example.com",
      authRole: "Moderator",
    });
    expect(mockCreateGo).not.toHaveBeenCalled();
    expect(mockPatchGo).not.toHaveBeenCalled();
  });
});
