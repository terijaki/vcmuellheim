import { describe, expect, it } from "vite-plus/test";
import { buildTabelleProjection } from "./build-tabelle-projection";

describe("buildTabelleProjection", () => {
  it("builds ordered league standings for configured-club teams without requiring season discovery at read time", () => {
    const projection = buildTabelleProjection({
      seasonUuid: "season-26",
      seasonName: "2026/27",
      datasetId: "current",
      updatedAt: "2026-09-09T12:00:00.000Z",
      ttl: 1_800_000_000,
      configuredSportsclubUuids: new Set(["club-vcm", "club-mgv"]),
      teams: [
        {
          uuid: "team-vcm-1",
          sportsclubUuid: "club-vcm",
          leagueUuid: "league-bezirk",
          leagueName: "Bezirksliga",
          leagueHierarchyLevel: 5,
          seasonUuid: "season-26",
          seasonName: "2026/27",
        },
        {
          uuid: "team-mgv-1",
          sportsclubUuid: "club-mgv",
          leagueUuid: "league-landes",
          leagueName: "Landesliga",
          leagueHierarchyLevel: 3,
          seasonUuid: "season-26",
          seasonName: "2026/27",
        },
        {
          uuid: "team-other",
          sportsclubUuid: "club-other",
          leagueUuid: "league-other",
          leagueName: "Other League",
          leagueHierarchyLevel: 1,
          seasonUuid: "season-26",
          seasonName: "2026/27",
        },
      ],
      rankingsByLeagueUuid: new Map([
        [
          "league-landes",
          {
            leagueUuid: "league-landes",
            seasonUuid: "season-26",
            leagueName: "Landesliga",
            seasonName: "2026/27",
            teams: [
              {
                uuid: "team-mgv-1",
                teamName: "Markgräfler Volleys",
                rank: 2,
                sportsclubUuid: "club-mgv",
                points: 10,
                wins: 5,
                matchesPlayed: 6,
                setWins: 15,
                setLosses: 8,
              },
            ],
          },
        ],
        [
          "league-bezirk",
          {
            leagueUuid: "league-bezirk",
            seasonUuid: "season-26",
            leagueName: "Bezirksliga",
            seasonName: "2026/27",
            teams: [
              {
                uuid: "team-vcm-1",
                teamName: "VC Müllheim 1",
                rank: 1,
                sportsclubUuid: "club-vcm",
                points: 12,
                wins: 6,
                matchesPlayed: 6,
                setWins: 18,
                setLosses: 4,
              },
            ],
          },
        ],
      ]),
    });

    expect(projection.map((league) => league.leagueUuid)).toEqual([
      "league-landes",
      "league-bezirk",
    ]);
    expect(projection[0]?.leagueSortKey.startsWith("00003#")).toBe(true);
    expect(projection[0]?.ownedTeamUuids).toEqual(["team-mgv-1"]);
    expect(projection[0]?.teams[0]?.teamName).toBe("Markgräfler Volleys");
    expect(projection[1]?.datasetId).toBe("current");
    expect(projection.some((league) => league.leagueUuid === "league-other")).toBe(false);
  });

  it("skips leagues that have no ranking projection yet", () => {
    const projection = buildTabelleProjection({
      seasonUuid: "season-26",
      datasetId: "current",
      updatedAt: "2026-09-09T12:00:00.000Z",
      ttl: 1_800_000_000,
      configuredSportsclubUuids: new Set(["club-vcm"]),
      teams: [
        {
          uuid: "team-vcm-1",
          sportsclubUuid: "club-vcm",
          leagueUuid: "league-bezirk",
          leagueName: "Bezirksliga",
          seasonUuid: "season-26",
          seasonName: "2026/27",
        },
      ],
      rankingsByLeagueUuid: new Map(),
    });

    expect(projection).toEqual([]);
  });
});
