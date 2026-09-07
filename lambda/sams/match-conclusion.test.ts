import { describe, expect, it } from "vite-plus/test";
import { findNewlyConcludedMatches, type MatchForConclusion } from "./match-conclusion";

const CLUB_A = "club-a";
const CLUB_B = "club-b";
const OTHER = "other-club";
const CONFIGURED = new Set([CLUB_A, CLUB_B]);

function match(
  partial: Partial<MatchForConclusion> & Pick<MatchForConclusion, "uuid">,
): MatchForConclusion {
  return {
    hasResult: false,
    team1: { sportsclubUuid: CLUB_A },
    team2: { sportsclubUuid: OTHER },
    ...partial,
  };
}

describe("findNewlyConcludedMatches", () => {
  it("returns matches that transition hasResult from false to true", () => {
    const previous = [match({ uuid: "m1", hasResult: false })];
    const incoming = [match({ uuid: "m1", hasResult: true })];

    expect(findNewlyConcludedMatches(previous, incoming, CONFIGURED).map((m) => m.uuid)).toEqual([
      "m1",
    ]);
  });

  it("skips matches that already had a result", () => {
    const previous = [match({ uuid: "m1", hasResult: true })];
    const incoming = [match({ uuid: "m1", hasResult: true })];

    expect(findNewlyConcludedMatches(previous, incoming, CONFIGURED)).toEqual([]);
  });

  it("skips first-seen matches that already have a result (no backfill)", () => {
    const incoming = [match({ uuid: "m1", hasResult: true })];

    expect(findNewlyConcludedMatches([], incoming, CONFIGURED)).toEqual([]);
  });

  it("skips matches that do not involve a configured club", () => {
    const previous = [
      match({
        uuid: "m1",
        hasResult: false,
        team1: { sportsclubUuid: OTHER },
        team2: { sportsclubUuid: "another" },
      }),
    ];
    const incoming = [
      match({
        uuid: "m1",
        hasResult: true,
        team1: { sportsclubUuid: OTHER },
        team2: { sportsclubUuid: "another" },
      }),
    ];

    expect(findNewlyConcludedMatches(previous, incoming, CONFIGURED)).toEqual([]);
  });

  it("deduplicates the same UUID when present on both club sides", () => {
    const previous = [
      match({
        uuid: "m1",
        hasResult: false,
        team1: { sportsclubUuid: CLUB_A },
        team2: { sportsclubUuid: CLUB_B },
      }),
    ];
    const incoming = [
      match({
        uuid: "m1",
        hasResult: true,
        team1: { sportsclubUuid: CLUB_A },
        team2: { sportsclubUuid: CLUB_B },
      }),
      match({
        uuid: "m1",
        hasResult: true,
        team1: { sportsclubUuid: CLUB_A },
        team2: { sportsclubUuid: CLUB_B },
      }),
    ];

    expect(findNewlyConcludedMatches(previous, incoming, CONFIGURED).map((m) => m.uuid)).toEqual([
      "m1",
    ]);
  });

  it("includes matches where only team2 is a configured club", () => {
    const previous = [
      match({
        uuid: "m1",
        hasResult: false,
        team1: { sportsclubUuid: OTHER },
        team2: { sportsclubUuid: CLUB_A },
      }),
    ];
    const incoming = [
      match({
        uuid: "m1",
        hasResult: true,
        team1: { sportsclubUuid: OTHER },
        team2: { sportsclubUuid: CLUB_A },
      }),
    ];

    expect(findNewlyConcludedMatches(previous, incoming, CONFIGURED)).toHaveLength(1);
  });
});
