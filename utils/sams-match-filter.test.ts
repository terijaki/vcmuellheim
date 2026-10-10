import { describe, expect, it } from "vite-plus/test";
import {
  filterAndSortSamsMatches,
  filterHomeMatches,
  isMatchHostedByOwnedTeam,
} from "@/utils/sams-match-filter";

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

describe("isMatchHostedByOwnedTeam", () => {
  const ownedTeamUuids = new Set(["our-home", "our-other"]);

  it("is true when host is an owned team", () => {
    expect(isMatchHostedByOwnedTeam({ host: "our-home" }, ownedTeamUuids)).toBe(true);
  });

  it("is false when host is not an owned team", () => {
    expect(isMatchHostedByOwnedTeam({ host: "opponent-host" }, ownedTeamUuids)).toBe(false);
  });

  it("is false when host is missing", () => {
    expect(isMatchHostedByOwnedTeam({}, ownedTeamUuids)).toBe(false);
  });
});

describe("filterHomeMatches", () => {
  const ownedTeamUuids = new Set(["our-home", "our-other"]);

  const matches = [
    {
      uuid: "home-as-team2",
      host: "our-home",
      team1: { uuid: "away-guest" },
      team2: { uuid: "our-home" },
    },
    {
      uuid: "away-as-team1",
      host: "opponent-host",
      team1: { uuid: "our-home" },
      team2: { uuid: "guest-b" },
    },
    {
      uuid: "other-home",
      host: "our-other",
      team1: { uuid: "our-other" },
      team2: { uuid: "guest" },
    },
    {
      uuid: "unrelated",
      host: "a",
      team1: { uuid: "a" },
      team2: { uuid: "b" },
    },
  ];

  it("keeps only matches whose SAMS host is an owned team", () => {
    const result = filterHomeMatches(matches, ownedTeamUuids);
    expect(result.map((m) => m.uuid)).toEqual(["home-as-team2", "other-home"]);
  });

  it("returns an empty list when no owned teams are hosting", () => {
    const result = filterHomeMatches(matches, new Set(["nobody"]));
    expect(result).toEqual([]);
  });
});
