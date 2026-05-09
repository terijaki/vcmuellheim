import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { memberAuthAdapter as MemberAuthAdapter } from "./auth-member-adapter";

// ── Fake member store ──────────────────────────────────────────────────────────

type FakeMember = {
  id: string;
  name: string;
  privateEmail?: string;
  proxyEmail?: string;
  authRole?: "Admin" | "Moderator";
  createdAt: string;
  updatedAt: string;
};

function makeFakeMemberDb(members: FakeMember[]) {
  return {
    member: {
      get: (key: { id: string }) => ({
        go: async () => ({ data: members.find((m) => m.id === key.id) ?? null }),
      }),
      query: {
        byPrivateEmail: ({ privateEmail }: { privateEmail: string }) => ({
          go: async (opts?: { limit?: number }) => {
            const matches = members.filter((m) => m.privateEmail === privateEmail);
            return { data: opts?.limit ? matches.slice(0, opts.limit) : matches };
          },
        }),
        byProxyEmail: ({ proxyEmail }: { proxyEmail: string }) => ({
          go: async (opts?: { limit?: number }) => {
            const matches = members.filter((m) => m.proxyEmail === proxyEmail);
            return { data: opts?.limit ? matches.slice(0, opts.limit) : matches };
          },
        }),
      },
    },
  };
}

// ── Module mock ────────────────────────────────────────────────────────────────

let fakeDbResult: ReturnType<typeof makeFakeMemberDb>;

vi.mock("@/lib/db/electrodb-client", () => ({
  db: () => fakeDbResult,
}));

let adapter: typeof MemberAuthAdapter;

// biome-ignore lint/suspicious/noExplicitAny: better-auth adapter internal type
let adaptClient: (args: any) => Promise<unknown>;

// Helper to call the adapter's findOne through the factory (getModelName is identity)
async function findOne(args: {
  model: string;
  where: Array<{ field: string; value: unknown; operator?: string }>;
  select?: string[];
}) {
  // biome-ignore lint/suspicious/noExplicitAny: adapter internal
  return adaptClient(args);
}

beforeEach(async () => {
  adapter = (await import("./auth-member-adapter")).memberAuthAdapter;

  // Invoke the factory to get the adapter with a pass-through getModelName
  // biome-ignore lint/suspicious/noExplicitAny: factory introspection
  const built = (adapter as any)({ getModelName: (model: string) => model });
  adaptClient = built.findOne.bind(built);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

const ADMIN_MEMBER: FakeMember = {
  id: "m-admin",
  name: "Admin User",
  privateEmail: "admin@example.com",
  proxyEmail: "public-admin@proxy.example.com",
  authRole: "Admin",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const MODERATOR_MEMBER: FakeMember = {
  id: "m-mod",
  name: "Mod User",
  privateEmail: "mod@example.com",
  proxyEmail: "public-mod@proxy.example.com",
  authRole: "Moderator",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

const MEMBER_NO_ROLE: FakeMember = {
  id: "m-norole",
  name: "Regular Member",
  privateEmail: "norole@example.com",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("findOne — user model", () => {
  beforeEach(() => {
    fakeDbResult = makeFakeMemberDb([ADMIN_MEMBER, MODERATOR_MEMBER, MEMBER_NO_ROLE]);
  });

  it("finds an Admin member by privateEmail and maps it to email in auth view", async () => {
    const result = (await findOne({
      model: "user",
      where: [{ field: "email", value: "admin@example.com" }],
    })) as Record<string, unknown>;

    expect(result).not.toBeNull();
    expect(result.id).toBe("m-admin");
    expect(result.email).toBe("admin@example.com");
    expect(result.privateEmail).toBeUndefined();
  });

  it("finds a Moderator member by privateEmail", async () => {
    const result = (await findOne({
      model: "user",
      where: [{ field: "email", value: "mod@example.com" }],
    })) as Record<string, unknown>;

    expect(result).not.toBeNull();
    expect(result.id).toBe("m-mod");
    expect(result.email).toBe("mod@example.com");
  });

  it("always returns emailVerified: true in auth view", async () => {
    // toAuthView must always inject emailVerified: true so better-auth does not call updateUser(),
    // which would crash because our update() no-op returns null.
    const result = (await findOne({
      model: "user",
      where: [{ field: "email", value: "mod@example.com" }],
    })) as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.emailVerified).toBe(true);

    const admin = (await findOne({
      model: "user",
      where: [{ field: "email", value: "admin@example.com" }],
    })) as Record<string, unknown>;
    expect(admin.emailVerified).toBe(true);
  });

  it("finds a member by proxyEmail alias when privateEmail lookup fails, and still exposes privateEmail as email", async () => {
    const result = (await findOne({
      model: "user",
      where: [{ field: "email", value: "public-admin@proxy.example.com" }],
    })) as Record<string, unknown>;

    expect(result).not.toBeNull();
    expect(result.id).toBe("m-admin");
    // auth view always exposes privateEmail (canonical), not the proxy alias
    expect(result.email).toBe("admin@example.com");
  });

  it("returns null when no member has that email", async () => {
    const result = await findOne({
      model: "user",
      where: [{ field: "email", value: "unknown@example.com" }],
    });

    expect(result).toBeNull();
  });

  it("returns null for a member without Admin or Moderator role even if email matches", async () => {
    const result = await findOne({
      model: "user",
      where: [{ field: "email", value: "norole@example.com" }],
    });

    expect(result).toBeNull();
  });

  it("finds a member by id and maps privateEmail to email", async () => {
    const result = (await findOne({
      model: "user",
      where: [{ field: "id", value: "m-mod" }],
    })) as Record<string, unknown>;

    expect(result).not.toBeNull();
    expect(result.id).toBe("m-mod");
    expect(result.email).toBe("mod@example.com");
  });

  it("returns null when looking up by id for a member without a role", async () => {
    const result = await findOne({ model: "user", where: [{ field: "id", value: "m-norole" }] });

    expect(result).toBeNull();
  });

  it("returns null when looking up by id for a non-existent member", async () => {
    const result = await findOne({
      model: "user",
      where: [{ field: "id", value: "does-not-exist" }],
    });

    expect(result).toBeNull();
  });

  it("applies field selection when select is provided", async () => {
    const result = (await findOne({
      model: "user",
      where: [{ field: "email", value: "admin@example.com" }],
      select: ["id", "email"],
    })) as Record<string, unknown>;

    expect(result).not.toBeNull();
    expect(result.id).toBe("m-admin");
    expect(result.email).toBe("admin@example.com");
    expect(result.role).toBeUndefined();
    expect(result.name).toBeUndefined();
  });
});

describe("findOne — non-user models return null", () => {
  beforeEach(() => {
    fakeDbResult = makeFakeMemberDb([ADMIN_MEMBER]);
  });

  it("returns null for session model", async () => {
    const result = await findOne({ model: "session", where: [{ field: "token", value: "tok" }] });
    expect(result).toBeNull();
  });

  it("returns null for verification model", async () => {
    const result = await findOne({
      model: "verification",
      where: [{ field: "identifier", value: "admin@example.com" }],
    });
    expect(result).toBeNull();
  });

  it("returns null for account model", async () => {
    const result = await findOne({
      model: "account",
      where: [{ field: "userId", value: "m-admin" }],
    });
    expect(result).toBeNull();
  });
});
