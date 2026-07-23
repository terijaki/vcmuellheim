import { describe, expect, it } from "vite-plus/test";
import { mapRosterOfficials, mapRosterPlayers, pseudoRosterUuid } from "@/lib/sams/roster-mapping";

describe("pseudoRosterUuid", () => {
  it("derives stable UUIDs from team and field data", () => {
    const first = pseudoRosterUuid("team-1", "player", "Max Mustermann", 7);
    const second = pseudoRosterUuid("team-1", "player", "Max Mustermann", 7);
    const different = pseudoRosterUuid("team-1", "player", "Max Mustermann", 8);

    expect(first).toBe(second);
    expect(first).not.toBe(different);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("mapRosterPlayers", () => {
  it("filters empty names and fills missing API uuids", () => {
    const players = mapRosterPlayers("team-1", [
      { name: "  ", uuid: "skip-me" },
      { name: "Anna Becker", jerseyNumber: 12 },
    ]);

    expect(players).toHaveLength(1);
    expect(players[0]?.name).toBe("Anna Becker");
    expect(players[0]?.jerseyNumber).toBe(12);
    expect(players[0]?.uuid).toBeTruthy();
  });
});

describe("mapRosterOfficials", () => {
  it("maps officials with optional roles", () => {
    const officials = mapRosterOfficials("team-1", [{ name: "Coach Name", role: "Trainer" }]);
    expect(officials).toEqual([expect.objectContaining({ name: "Coach Name", role: "Trainer" })]);
  });
});
