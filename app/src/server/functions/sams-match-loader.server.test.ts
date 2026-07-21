import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  loadSamsMatches,
  readSamsMatchesCache,
  resolveSamsMatchesEffectiveInput,
  resolveSamsMatchesForSsr,
  resolveSamsMatchesQuery,
} from "./sams-match-loader.server";

vi.mock("@codegen/sams/generated", () => ({
  getAllLeagueMatches: vi.fn(),
}));

vi.mock("@webapp/server/queries", () => ({
  getAllSamsClubs: vi.fn(),
  getAllSamsTeams: vi.fn(),
}));

vi.mock("@webapp/server/ddb-cache", () => ({
  readCacheEntry: vi.fn(),
  writeCacheEntry: vi.fn(),
}));

import { getAllLeagueMatches } from "@codegen/sams/generated";
import { readCacheEntry, writeCacheEntry } from "@webapp/server/ddb-cache";
import { getAllSamsClubs, getAllSamsTeams } from "@webapp/server/queries";

const mockGetAllLeagueMatches = vi.mocked(getAllLeagueMatches);
const mockGetAllSamsClubs = vi.mocked(getAllSamsClubs);
const mockGetAllSamsTeams = vi.mocked(getAllSamsTeams);
const mockReadCacheEntry = vi.mocked(readCacheEntry);
const mockWriteCacheEntry = vi.mocked(writeCacheEntry);

const configuredClubs: ClubResponse[] = [
  {
    type: "club",
    name: "VC Müllheim",
    sportsclubUuid: "uuid-a",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    type: "club",
    name: "Markgräfler Volleys",
    sportsclubUuid: "uuid-b",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("resolveSamsMatchesQuery", () => {
  beforeEach(() => {
    mockGetAllSamsClubs.mockReset();
  });

  it("skips default club resolution when team filter is set", async () => {
    const result = await resolveSamsMatchesQuery({ team: "team-1", range: "future" });

    expect(mockGetAllSamsClubs).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      team: "team-1",
      range: "future",
      effectiveSportsclubUuids: [],
    });
  });

  it("returns null when configured clubs cannot be resolved", async () => {
    mockGetAllSamsClubs.mockResolvedValue({ items: [], lastEvaluatedKey: undefined });

    const result = await resolveSamsMatchesQuery({ range: "past" });

    expect(result).toBeNull();
  });

  it("resolves configured sportsclub UUIDs for unscoped queries", async () => {
    mockGetAllSamsClubs.mockResolvedValue({ items: configuredClubs });

    const result = await resolveSamsMatchesQuery({ range: "future", limit: 10 });

    expect(result?.effectiveSportsclubUuids.sort()).toEqual(["uuid-a", "uuid-b"]);
    expect(result?.cacheKey).toContain("uuid-a");
  });
});

const syncedTeam: TeamResponse = {
  type: "team",
  uuid: "team-1",
  name: "VC Müllheim",
  sportsclubUuid: "uuid-a",
  associationUuid: "assoc-1",
  leagueUuid: "league-1",
  leagueName: "Bezirksliga",
  seasonUuid: "season-synced",
  seasonName: "2025/26",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("readSamsMatchesCache season fallback", () => {
  beforeEach(() => {
    mockGetAllSamsClubs.mockReset();
    mockGetAllSamsTeams.mockReset();
    mockReadCacheEntry.mockReset();
    mockGetAllSamsClubs.mockResolvedValue({ items: configuredClubs });
  });

  it("retries cache with synced season when the unscoped key misses", async () => {
    mockGetAllSamsTeams.mockResolvedValue({
      items: [syncedTeam],
      lastEvaluatedKey: undefined,
    });
    mockReadCacheEntry
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ matches: [], timestamp: "2026-07-21T08:00:00.000Z" });

    const result = await readSamsMatchesCache({ range: "future" });

    expect(result?.matches).toEqual([]);
    expect(mockReadCacheEntry).toHaveBeenCalledTimes(2);
    expect(mockReadCacheEntry.mock.calls[1]?.[0]).toContain("season-synced");
  });

  it("returns null when season sync fails and unscoped cache misses", async () => {
    mockGetAllSamsTeams.mockRejectedValue(new Error("DynamoDB unavailable"));
    mockReadCacheEntry.mockResolvedValue(null);

    const result = await readSamsMatchesCache({ range: "future" });

    expect(result).toBeNull();
    expect(mockReadCacheEntry).toHaveBeenCalledTimes(1);
  });

  it("uses the unscoped cache entry without querying synced season", async () => {
    const cached = { matches: [{ uuid: "match-1" }], timestamp: "2026-07-21T08:00:00.000Z" };
    mockReadCacheEntry.mockResolvedValueOnce(cached);

    const result = await readSamsMatchesCache({ range: "future" });

    expect(result).toEqual(cached);
    expect(mockGetAllSamsTeams).not.toHaveBeenCalled();
    expect(mockReadCacheEntry).toHaveBeenCalledTimes(1);
  });
});

describe("resolveSamsMatchesForSsr", () => {
  beforeEach(() => {
    mockGetAllSamsClubs.mockReset();
    mockGetAllSamsTeams.mockReset();
    mockReadCacheEntry.mockReset();
    mockGetAllSamsClubs.mockResolvedValue({ items: configuredClubs });
  });

  it("includes synced season in effectiveInput when season-scoped cache is used", async () => {
    mockGetAllSamsTeams.mockResolvedValue({
      items: [syncedTeam],
      lastEvaluatedKey: undefined,
    });
    mockReadCacheEntry
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ matches: [], timestamp: "2026-07-21T08:00:00.000Z" });

    const result = await resolveSamsMatchesForSsr({ range: "future" });

    expect(result?.effectiveInput.season).toBe("season-synced");
    expect(result?.effectiveInput.range).toBe("future");
  });
});

describe("resolveSamsMatchesEffectiveInput", () => {
  beforeEach(() => {
    mockGetAllSamsClubs.mockReset();
    mockGetAllSamsTeams.mockReset();
    mockReadCacheEntry.mockReset();
    mockGetAllSamsClubs.mockResolvedValue({ items: configuredClubs });
  });

  it("includes synced season without reading cache", async () => {
    mockGetAllSamsTeams.mockResolvedValue({
      items: [syncedTeam],
      lastEvaluatedKey: undefined,
    });

    const result = await resolveSamsMatchesEffectiveInput({ range: "future" });

    expect(result).toMatchObject({ range: "future", season: "season-synced" });
    expect(mockReadCacheEntry).not.toHaveBeenCalled();
  });

  it("returns null when configured clubs cannot be resolved", async () => {
    mockGetAllSamsClubs.mockResolvedValue({ items: [], lastEvaluatedKey: undefined });

    await expect(resolveSamsMatchesEffectiveInput({ range: "past" })).resolves.toBeNull();
  });
});

describe("loadSamsMatches", () => {
  beforeEach(() => {
    mockGetAllSamsClubs.mockReset();
    mockGetAllSamsTeams.mockReset();
    mockReadCacheEntry.mockReset();
    mockWriteCacheEntry.mockReset();
    mockGetAllLeagueMatches.mockReset();
    mockGetAllSamsClubs.mockResolvedValue({ items: configuredClubs });
    mockReadCacheEntry.mockResolvedValue(null);
    mockWriteCacheEntry.mockResolvedValue(undefined);
  });

  it("fetches without for-season when season sync fails", async () => {
    mockGetAllSamsTeams.mockRejectedValue(new Error("DynamoDB unavailable"));
    mockGetAllLeagueMatches.mockResolvedValue({
      data: {
        content: [{ uuid: "m1", date: "2026-02-01", results: null }],
        last: true,
      },
      request: new Request("https://example.com/matches"),
      response: new Response(),
    });

    await loadSamsMatches({ range: "future" });

    expect(mockGetAllLeagueMatches).toHaveBeenCalled();
    const query = mockGetAllLeagueMatches.mock.calls[0]?.[0]?.query;
    expect(query?.["for-season"]).toBeUndefined();
  });

  it("returns season-scoped cache without calling the SAMS API", async () => {
    mockGetAllSamsTeams.mockResolvedValue({
      items: [syncedTeam],
      lastEvaluatedKey: undefined,
    });
    mockReadCacheEntry.mockResolvedValueOnce(null).mockResolvedValueOnce({
      matches: [{ uuid: "cached-match", date: "2026-01-01", results: { winner: "a" } }],
      timestamp: "2026-07-21T08:00:00.000Z",
    });

    const result = await loadSamsMatches({ range: "past" });

    expect(result.matches).toHaveLength(1);
    expect(mockGetAllLeagueMatches).not.toHaveBeenCalled();
  });

  it("writes cache after API fetch on cache miss", async () => {
    mockGetAllSamsTeams.mockRejectedValue(new Error("DynamoDB unavailable"));
    mockGetAllLeagueMatches.mockResolvedValue({
      data: {
        content: [{ uuid: "m1", date: "2026-01-10", results: { winner: "a" } }],
        last: true,
      },
      request: new Request("https://example.com/matches"),
      response: new Response(),
    });

    await loadSamsMatches({ range: "past", limit: 5 });

    expect(mockWriteCacheEntry).toHaveBeenCalledTimes(1);
    expect(mockGetAllLeagueMatches).toHaveBeenCalled();
  });

  it("calls the SAMS API with for-season when season sync succeeds on cache miss", async () => {
    mockGetAllSamsTeams.mockResolvedValue({
      items: [syncedTeam],
      lastEvaluatedKey: undefined,
    });
    mockGetAllLeagueMatches.mockResolvedValue({
      data: {
        content: [{ uuid: "m1", date: "2026-02-01", results: null }],
        last: true,
      },
      request: new Request("https://example.com/matches"),
      response: new Response(),
    });

    await loadSamsMatches({ range: "future" });

    expect(mockGetAllLeagueMatches).toHaveBeenCalled();
    const query = mockGetAllLeagueMatches.mock.calls[0]?.[0]?.query;
    expect(query?.["for-season"]).toBe("season-synced");
  });

  it("continues pagination when a non-terminal page has empty content", async () => {
    mockGetAllSamsTeams.mockResolvedValue({ items: [], lastEvaluatedKey: undefined });
    mockGetAllLeagueMatches
      .mockResolvedValueOnce({
        data: { content: [], last: false },
        request: new Request("https://example.com/matches?page=0"),
        response: new Response(),
      })
      .mockResolvedValueOnce({
        data: {
          content: [{ uuid: "m2", date: "2026-02-02", results: null }],
          last: true,
        },
        request: new Request("https://example.com/matches?page=1"),
        response: new Response(),
      });

    const result = await loadSamsMatches({ team: "team-1", range: "future" });

    expect(mockGetAllLeagueMatches).toHaveBeenCalledTimes(2);
    expect(result.matches).toHaveLength(1);
  });
});
