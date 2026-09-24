import { describe, expect, it } from "vite-plus/test";
import { buildPublicMembersPayload } from "./public-snapshots";

describe("buildPublicMembersPayload", () => {
  it("drops private email and groups public cards", () => {
    const payload = buildPublicMembersPayload([
      {
        id: "00000000-0000-4000-8000-000000000001",
        type: "member",
        name: "Ada",
        privateEmail: "ada@example.com",
        authRole: "Admin",
        isBoardMember: true,
        roleTitle: "Vorsitz",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        type: "member",
        name: "Bea",
        privateEmail: "bea@example.com",
        isTrainer: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        type: "member",
        name: "Cem",
        roleTitle: "Kassier",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(payload.items).toHaveLength(3);
    expect(payload.items[0]).not.toHaveProperty("privateEmail");
    expect(payload.items[0]).not.toHaveProperty("authRole");
    expect(payload.board.map((member) => member.name)).toEqual(["Ada"]);
    expect(payload.trainers.map((member) => member.name)).toEqual(["Bea"]);
    expect(payload.officials.map((member) => member.name)).toEqual(["Cem"]);
  });
});
