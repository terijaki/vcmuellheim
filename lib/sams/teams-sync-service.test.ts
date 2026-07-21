import { describe, expect, it } from "vite-plus/test";
import { buildSyncedTeamItem } from "@/lib/sams/teams-sync-service";

describe("buildSyncedTeamItem", () => {
  it("maps API team fields into a synced team record", () => {
    const team = buildSyncedTeamItem(
      {
        uuid: "team-1",
        name: "VC Müllheim",
        sportsclubUuid: "club-1",
        associationUuid: "assoc-1",
      },
      { uuid: "league-1", name: "Bezirksliga", leagueHierarchyUuid: "hier-1" },
      { uuid: "season-1", name: "2025/26" },
      new Map([["hier-1", 3]]),
      "2026-07-21T10:00:00.000Z",
      1_700_000_000,
    );

    expect(team).toMatchObject({
      uuid: "team-1",
      name: "VC Müllheim",
      nameSlug: "vc-muellheim",
      leagueHierarchyLevel: 3,
      seasonUuid: "season-1",
      ttl: 1_700_000_000,
    });
  });
});
