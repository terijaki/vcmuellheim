import { describe, expect, it } from "vite-plus/test";
import type { AppTermineMatchInput } from "@/lib/db/schemas";
import { buildHeimspieleProjection, selectHeimspieleCards } from "./build-heimspiele-projection";

function match(overrides: Partial<AppTermineMatchInput> = {}): AppTermineMatchInput {
  return {
    datasetId: "current",
    matchSortKey: "F#2026-10-01#m1",
    type: "apptermine",
    matchUuid: "m1",
    date: "2026-10-01T18:00:00.000Z",
    time: "18:00",
    leagueUuid: "league-1",
    leagueName: "Bezirksliga",
    team1: { uuid: "home", name: "VC", sportsclubUuid: "club-vcm" },
    team2: { uuid: "away", name: "Opp", sportsclubUuid: "club-opp" },
    location: { uuid: "hall-1", name: "Müllheim" },
    hasResult: false,
    isHomeGame: true,
    ownedTeamUuids: ["home"],
    updatedAt: "2026-09-01T00:00:00.000Z",
    ttl: 1,
    ...overrides,
  };
}

describe("buildHeimspieleProjection", () => {
  it("keeps future home games with league name and opponent", () => {
    const games = buildHeimspieleProjection([
      match(),
      match({
        matchUuid: "away-game",
        isHomeGame: false,
        team1: { uuid: "other", name: "Other", sportsclubUuid: "club-x" },
        team2: { uuid: "home", name: "VC", sportsclubUuid: "club-vcm" },
      }),
      match({ matchUuid: "played", hasResult: true, matchSortKey: "P#2026-09-01#played" }),
    ]);

    expect(games).toEqual([
      {
        matchUuid: "m1",
        date: "2026-10-01T18:00:00.000Z",
        time: "18:00",
        leagueUuid: "league-1",
        leagueName: "Bezirksliga",
        team1Uuid: "home",
        team2Uuid: "away",
        opponentName: "Opp",
        locationName: "Müllheim",
        locationUuid: "hall-1",
      },
    ]);
  });
});

describe("selectHeimspieleCards", () => {
  it("applies the 14-day window and the four date-location cap at read time", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    const games = [
      {
        matchUuid: "inside",
        date: "2026-10-10T18:00:00.000Z",
        team1Uuid: "home",
        team2Uuid: "a",
        opponentName: "A",
        locationUuid: "hall",
      },
      {
        matchUuid: "same-day",
        date: "2026-10-10T20:00:00.000Z",
        team1Uuid: "home",
        team2Uuid: "b",
        opponentName: "B",
        locationUuid: "hall",
      },
      {
        matchUuid: "too-late",
        date: "2026-10-20T18:00:00.000Z",
        team1Uuid: "home",
        team2Uuid: "c",
        opponentName: "C",
        locationUuid: "hall",
      },
    ];

    expect(selectHeimspieleCards(games, now).map((game) => game.matchUuid)).toEqual([
      "inside",
      "same-day",
    ]);
  });
});
