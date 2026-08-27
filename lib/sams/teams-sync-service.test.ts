import type { SeasonDto } from "sams-rest-v2";
import { describe, expect, it, vi } from "vite-plus/test";
import { buildSyncedTeamItem, fetchCurrentSeasonUuid } from "@/lib/sams/teams-sync-service";

vi.mock("@/utils/sams-client", () => ({
  sams: {
    getAllSeasons: vi.fn(),
    getAllLeagueHierarchies: vi.fn(),
    getAllLeagues: vi.fn(),
    getTeamRosterByTeamUuid: vi.fn(),
    getTeamsForLeague: vi.fn(),
  },
}));

import { sams } from "@/utils/sams-client";

const mockGetAllSeasons = vi.mocked(sams.getAllSeasons);

function mockSeasonsResponse(seasons: SeasonDto[]) {
  mockGetAllSeasons.mockImplementation(async () => ({
    data: seasons,
    request: new Request("https://example.com/seasons"),
    response: new Response(),
  }));
}

describe("fetchCurrentSeasonUuid", () => {
  it("returns the season marked as current", async () => {
    mockSeasonsResponse([
      { uuid: "old", name: "2024/25", currentSeason: false },
      { uuid: "current", name: "2025/26", currentSeason: true },
    ]);

    await expect(fetchCurrentSeasonUuid()).resolves.toEqual({
      uuid: "current",
      name: "2025/26",
    });
  });

  it("throws when no current season exists", async () => {
    mockSeasonsResponse([{ uuid: "old", name: "2024/25", currentSeason: false }]);

    await expect(fetchCurrentSeasonUuid()).rejects.toThrow("Current season not found");
  });
});

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
