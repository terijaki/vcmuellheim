import { describe, expect, it } from "vite-plus/test";
import { filterAndSortSamsMatches, filterHomeMatches } from "@/utils/sams-match-filter";

describe("filterAndSortSamsMatches", () => {
  const matches = [
    { uuid: "1", date: "2026-01-10", hasResult: true },
    { uuid: "2", date: "2026-01-05", hasResult: true },
    { uuid: "3", date: "2026-02-01", hasResult: false },
    { uuid: "4", date: "2026-01-20", hasResult: false },
  ];

  it("keeps completed matches newest-first for past range", () => {
    const result = filterAndSortSamsMatches(matches, { range: "past" });
    expect(result.map((m) => m.uuid)).toEqual(["1", "2"]);
  });

  it("keeps unplayed matches oldest-first for future range", () => {
    const result = filterAndSortSamsMatches(matches, { range: "future" });
    expect(result.map((m) => m.uuid)).toEqual(["4", "3"]);
  });

  it("applies limit after range filtering", () => {
    const result = filterAndSortSamsMatches(matches, { range: "future", limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]?.uuid).toBe("4");
  });
});

describe("filterHomeMatches", () => {
  const ownedTeamUuids = new Set(["our-home", "our-other"]);

  const matches = [
    { uuid: "home", team1: { uuid: "our-home" }, team2: { uuid: "away-guest" } },
    { uuid: "away", team1: { uuid: "opponent-home" }, team2: { uuid: "our-home" } },
    { uuid: "other-home", team1: { uuid: "our-other" }, team2: { uuid: "guest" } },
    { uuid: "unrelated", team1: { uuid: "a" }, team2: { uuid: "b" } },
  ];

  it("keeps only matches where an owned team is the home side (team1)", () => {
    const result = filterHomeMatches(matches, ownedTeamUuids);
    expect(result.map((m) => m.uuid)).toEqual(["home", "other-home"]);
  });

  it("returns an empty list when no owned teams are hosting", () => {
    const result = filterHomeMatches(matches, new Set(["nobody"]));
    expect(result).toEqual([]);
  });
});
