import { describe, expect, it, vi } from "vite-plus/test";
import {
  dedupeSamsMatchesByUuid,
  getOwnedSamsSportsclubUuids,
  getOwnedSamsTeamUuids,
  resolveConfiguredSamsSportsclubUuids,
  resolveSyncedSeasonUuidFromTeams,
  shouldResolveDefaultSamsSportsclubs,
} from "./sams";

describe("resolveConfiguredSamsSportsclubUuids", () => {
  it("returns the configured club UUIDs in a stable order", () => {
    const result = resolveConfiguredSamsSportsclubUuids([
      { nameSlug: "markgraefler-volleys", sportsclubUuid: "club-b" },
      { nameSlug: "vc-muellheim", sportsclubUuid: "club-a" },
      { nameSlug: "other-club", sportsclubUuid: "club-c" },
      { nameSlug: "vc-muellheim", sportsclubUuid: "club-a" },
    ]);

    expect(result).toEqual(["club-a", "club-b"]);
  });
});

describe("shouldResolveDefaultSamsSportsclubs", () => {
  it("keeps dual-club defaults unless an explicit sportsclub filter replaces them", () => {
    expect(shouldResolveDefaultSamsSportsclubs({})).toBe(true);
    expect(shouldResolveDefaultSamsSportsclubs({ team: "team-a" })).toBe(true);
    expect(shouldResolveDefaultSamsSportsclubs({ league: "league-a" })).toBe(true);
    expect(shouldResolveDefaultSamsSportsclubs({ sportsclub: "club-a" })).toBe(false);
  });
});

describe("resolveSyncedSeasonUuidFromTeams", () => {
  it("returns the unanimous season UUID when all teams agree", () => {
    expect(
      resolveSyncedSeasonUuidFromTeams([{ seasonUuid: "season-a" }, { seasonUuid: "season-a" }]),
    ).toBe("season-a");
  });

  it("returns the majority season UUID", () => {
    expect(
      resolveSyncedSeasonUuidFromTeams([
        { seasonUuid: "season-a" },
        { seasonUuid: "season-a" },
        { seasonUuid: "season-b" },
      ]),
    ).toBe("season-a");
  });

  it("breaks ties by most recently updated team", () => {
    expect(
      resolveSyncedSeasonUuidFromTeams([
        { seasonUuid: "season-a", updatedAt: "2026-01-01T00:00:00.000Z" },
        { seasonUuid: "season-b", updatedAt: "2026-02-01T00:00:00.000Z" },
      ]),
    ).toBe("season-b");
  });

  it("calls onDisagreement when multiple seasons are present", () => {
    const onDisagreement = vi.fn();
    resolveSyncedSeasonUuidFromTeams([{ seasonUuid: "season-a" }, { seasonUuid: "season-b" }], {
      onDisagreement,
    });
    expect(onDisagreement).toHaveBeenCalledWith(["season-a", "season-b"]);
  });

  it("returns undefined when no team has a season UUID", () => {
    expect(resolveSyncedSeasonUuidFromTeams([{}, { seasonUuid: null }])).toBeUndefined();
  });
});

describe("owned SAMS UUID helpers", () => {
  it("derives team and sportsclub ownership sets from UUIDs", () => {
    const teams = [
      { uuid: "team-1", sportsclubUuid: "club-a" },
      { uuid: "team-2", sportsclubUuid: "club-b" },
      { uuid: "team-3", sportsclubUuid: "club-a" },
    ];

    expect([...getOwnedSamsTeamUuids(teams)]).toEqual(["team-1", "team-2", "team-3"]);
    expect([...getOwnedSamsSportsclubUuids(teams)]).toEqual(["club-a", "club-b"]);
  });
});

describe("dedupeSamsMatchesByUuid", () => {
  it("keeps the first occurrence of each UUID and preserves UUID-less entries", () => {
    const result = dedupeSamsMatchesByUuid([
      { uuid: "match-1", label: "first" },
      { uuid: "match-1", label: "duplicate" },
      { uuid: undefined, label: "no-uuid-a" },
      { uuid: undefined, label: "no-uuid-b" },
      { uuid: "match-2", label: "second" },
    ]);

    expect(result).toEqual([
      { uuid: "match-1", label: "first" },
      { uuid: undefined, label: "no-uuid-a" },
      { uuid: undefined, label: "no-uuid-b" },
      { uuid: "match-2", label: "second" },
    ]);
  });
});
