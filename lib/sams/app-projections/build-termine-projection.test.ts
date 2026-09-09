import { describe, expect, it } from "vite-plus/test";
import { buildTermineProjection } from "./build-termine-projection";

describe("buildTermineProjection", () => {
  it("builds date-sorted match rows for configured clubs with display metadata", () => {
    const projection = buildTermineProjection({
      datasetId: "current",
      updatedAt: "2026-09-09T12:00:00.000Z",
      ttl: 1_800_000_000,
      configuredSportsclubUuids: new Set(["club-vcm"]),
      ownedTeamUuids: new Set(["team-vcm-1"]),
      leagueNameByUuid: new Map([["league-bezirk", "Bezirksliga"]]),
      matches: [
        {
          uuid: "match-away",
          date: "2026-10-02T18:00:00.000Z",
          time: "18:00",
          leagueUuid: "league-bezirk",
          seasonUuid: "season-26",
          team1: { uuid: "team-opp", name: "Opponent", sportsclubUuid: "club-opp" },
          team2: { uuid: "team-vcm-1", name: "VC Müllheim 1", sportsclubUuid: "club-vcm" },
          location: { uuid: "loc-1", name: "Halle Opp" },
          hasResult: false,
        },
        {
          uuid: "match-home-past",
          date: "2026-09-01T18:00:00.000Z",
          time: "18:00",
          leagueUuid: "league-bezirk",
          seasonUuid: "season-26",
          team1: { uuid: "team-vcm-1", name: "VC Müllheim 1", sportsclubUuid: "club-vcm" },
          team2: { uuid: "team-opp", name: "Opponent", sportsclubUuid: "club-opp" },
          hasResult: true,
          result: { winner: "team-vcm-1", setPoints: "3:1" },
        },
        {
          uuid: "match-unrelated",
          date: "2026-10-03T18:00:00.000Z",
          leagueUuid: "league-other",
          seasonUuid: "season-26",
          team1: { uuid: "a", name: "A", sportsclubUuid: "club-a" },
          team2: { uuid: "b", name: "B", sportsclubUuid: "club-b" },
          hasResult: false,
        },
      ],
    });

    // F# (future) sorts before P# (past) so each range can be queried by SK prefix.
    expect(projection.map((match) => match.matchUuid)).toEqual(["match-away", "match-home-past"]);
    expect(projection[0]?.matchSortKey.startsWith("F#")).toBe(true);
    expect(projection[0]?.isHomeGame).toBe(false);
    expect(projection[0]?.leagueName).toBe("Bezirksliga");
    expect(projection[1]?.matchSortKey.startsWith("P#")).toBe(true);
    expect(projection[1]?.isHomeGame).toBe(true);
  });

  it("is idempotent for the same match set", () => {
    const input = {
      datasetId: "current" as const,
      updatedAt: "2026-09-09T12:00:00.000Z",
      ttl: 1_800_000_000,
      configuredSportsclubUuids: new Set(["club-vcm"]),
      ownedTeamUuids: new Set(["team-vcm-1"]),
      leagueNameByUuid: new Map<string, string>(),
      matches: [
        {
          uuid: "match-1",
          date: "2026-10-02T18:00:00.000Z",
          team1: { uuid: "team-vcm-1", name: "VC", sportsclubUuid: "club-vcm" },
          team2: { uuid: "team-opp", name: "Opp", sportsclubUuid: "club-opp" },
          hasResult: false,
        },
      ],
    };

    expect(buildTermineProjection(input)).toEqual(buildTermineProjection(input));
  });
});
