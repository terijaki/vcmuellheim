import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import dayjs from "dayjs";

const { mockKeyGet, mockKeyCreate, mockKeyDelete, mockKeyPatch, mockKeyList, mockMemberGet } =
  vi.hoisted(() => ({
    mockKeyGet: vi.fn(),
    mockKeyCreate: vi.fn(),
    mockKeyDelete: vi.fn(),
    mockKeyPatch: vi.fn(),
    mockKeyList: vi.fn(),
    mockMemberGet: vi.fn(),
  }));

vi.mock("@/lib/db/electrodb-client", () => ({
  db: vi.fn(() => ({
    apiKey: {
      get: () => ({ go: mockKeyGet }),
      create: (item: unknown) => ({ go: () => mockKeyCreate(item) }),
      delete: () => ({ go: mockKeyDelete }),
      patch: () => ({
        set: (value: unknown) => ({ go: () => mockKeyPatch(value) }),
      }),
      query: {
        byType: () => ({ go: mockKeyList }),
      },
    },
    member: {
      get: () => ({ go: mockMemberGet }),
    },
  })),
}));

const memberId = "11111111-1111-4111-8111-111111111111";

type StoredKey = {
  id: string;
  scope: string;
  secretHash: string;
  expiresAt: string;
  lastUsedAt?: string;
};

let storedKey: StoredKey | undefined;

const adminMember = {
  id: memberId,
  type: "member",
  name: "Ada Admin",
  authRole: "Admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("api keys", () => {
  beforeEach(() => {
    mockKeyGet.mockReset();
    mockKeyCreate.mockReset();
    mockKeyDelete.mockReset();
    mockKeyPatch.mockReset();
    mockKeyList.mockReset();
    mockMemberGet.mockReset();
    storedKey = undefined;
    mockKeyCreate.mockImplementation((item: StoredKey) => {
      storedKey = item;
      return { data: item };
    });
    mockKeyPatch.mockResolvedValue({ data: {} });
    mockKeyDelete.mockResolvedValue({ data: {} });
    mockMemberGet.mockResolvedValue({ data: adminMember });
  });

  it("stores a hash, a one-year expiry, and returns the token once", async () => {
    const { createApiKey } = await import("./api-keys.server");
    const created = await createApiKey({
      label: "  Redaktion  ",
      memberId,
      scope: "news",
    });

    expect(created.token.startsWith(`vcm_${created.apiKey.id}_`)).toBe(true);
    expect(created.apiKey.expiresAt).toBe(
      dayjs(created.apiKey.createdAt).add(1, "year").toISOString(),
    );
    expect(created.apiKey.prefix).toBe(created.token.slice(0, 12));
    expect(created.apiKey).not.toHaveProperty("secretHash");
    expect(created.apiKey.scope).toBe("news");
    expect(created.apiKey.label).toBe("Redaktion");

    expect(storedKey?.scope).toBe("news");
    expect(storedKey?.secretHash.startsWith("scrypt$")).toBe(true);

    const { authenticateApiKey } = await import("./api-keys.server");
    mockKeyGet.mockResolvedValue({ data: storedKey });
    const access = await authenticateApiKey(`Bearer ${created.token}`, "news");
    expect(access.ok).toBe(true);
  });

  it("rejects a member without CMS access and does not write a key", async () => {
    mockMemberGet.mockResolvedValue({
      data: { ...adminMember, authRole: undefined },
    });
    const { createApiKey } = await import("./api-keys.server");
    await expect(createApiKey({ label: "Nope", memberId, scope: "news" })).rejects.toThrow(
      "Nur Admins und Moderatoren können einen Schlüssel erhalten",
    );
    expect(mockKeyCreate).not.toHaveBeenCalled();
  });

  it("authenticates a valid key and records last use", async () => {
    const { authenticateApiKey, createApiKey } = await import("./api-keys.server");
    const created = await createApiKey({ label: "Skript", memberId, scope: "news" });
    mockKeyGet.mockResolvedValue({ data: storedKey });

    const now = new Date("2026-10-17T12:00:30.000Z");
    const access = await authenticateApiKey(`Bearer ${created.token}`, "news", now);

    expect(access.ok).toBe(true);
    expect(mockKeyPatch).toHaveBeenCalledWith({ lastUsedAt: now.toISOString() });
  });

  it("does not write last use again in the same minute", async () => {
    const { authenticateApiKey, createApiKey } = await import("./api-keys.server");
    const created = await createApiKey({ label: "Skript", memberId, scope: "news" });
    mockKeyGet.mockResolvedValue({
      data: { ...storedKey, lastUsedAt: "2026-10-17T12:00:01.000Z" },
    });

    const access = await authenticateApiKey(
      `Bearer ${created.token}`,
      "news",
      new Date("2026-10-17T12:00:59.000Z"),
    );

    expect(access.ok).toBe(true);
    expect(mockKeyPatch).not.toHaveBeenCalled();
  });

  it("rejects a missing token", async () => {
    const { authenticateApiKey } = await import("./api-keys.server");
    const access = await authenticateApiKey(null, "news");
    expect(access).toMatchObject({ ok: false, status: 401, reason: "missing_token" });
    expect(mockKeyGet).not.toHaveBeenCalled();
  });

  it("rejects an expired key", async () => {
    const { authenticateApiKey, createApiKey } = await import("./api-keys.server");
    const created = await createApiKey({ label: "Alt", memberId, scope: "news" });
    mockKeyGet.mockResolvedValue({
      data: { ...storedKey, expiresAt: "2020-01-01T00:00:00.000Z" },
    });

    const access = await authenticateApiKey(`Bearer ${created.token}`, "news", new Date());
    expect(access).toMatchObject({ ok: false, status: 401, reason: "expired" });
    expect(mockKeyPatch).not.toHaveBeenCalled();
  });

  it("rejects a key whose scope is not news", async () => {
    const { authenticateApiKey, createApiKey } = await import("./api-keys.server");
    const created = await createApiKey({ label: "Andere", memberId, scope: "news" });
    mockKeyGet.mockResolvedValue({ data: { ...storedKey, scope: "events" } });

    const access = await authenticateApiKey(`Bearer ${created.token}`, "news");
    expect(access).toMatchObject({
      ok: false,
      status: 403,
      code: "forbidden",
      reason: "wrong_scope",
    });
    expect(mockKeyPatch).not.toHaveBeenCalled();
  });

  it("rejects a key whose member lost CMS access", async () => {
    const { authenticateApiKey, createApiKey } = await import("./api-keys.server");
    const created = await createApiKey({ label: "Weg", memberId, scope: "news" });
    mockKeyGet.mockResolvedValue({ data: storedKey });
    mockMemberGet.mockResolvedValue({ data: { ...adminMember, authRole: undefined } });

    const access = await authenticateApiKey(`Bearer ${created.token}`, "news");
    expect(access).toMatchObject({ ok: false, status: 403, reason: "member_ineligible" });
    expect(mockKeyPatch).not.toHaveBeenCalled();
  });
});
