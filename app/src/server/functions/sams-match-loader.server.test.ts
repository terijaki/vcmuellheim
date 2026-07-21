import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { peekSamsMatches, resolveSamsMatchesQuery } from "./sams-match-loader.server";

vi.mock("@webapp/server/queries", () => ({
  getAllSamsClubs: vi.fn(),
  getAllSamsTeams: vi.fn(),
}));

vi.mock("@webapp/server/ddb-cache", () => ({
  readCacheEntry: vi.fn(),
  writeCacheEntry: vi.fn(),
}));

import { readCacheEntry } from "@webapp/server/ddb-cache";
import { getAllSamsClubs, getAllSamsTeams } from "@webapp/server/queries";

const mockGetAllSamsClubs = vi.mocked(getAllSamsClubs);
const mockGetAllSamsTeams = vi.mocked(getAllSamsTeams);
const mockReadCacheEntry = vi.mocked(readCacheEntry);

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

describe("peekSamsMatches season fallback", () => {
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

    const result = await peekSamsMatches({ range: "future" });

    expect(result?.matches).toEqual([]);
    expect(mockReadCacheEntry).toHaveBeenCalledTimes(2);
    expect(mockReadCacheEntry.mock.calls[1]?.[0]).toContain("season-synced");
  });

  it("returns null when season sync fails and unscoped cache misses", async () => {
    mockGetAllSamsTeams.mockRejectedValue(new Error("DynamoDB unavailable"));
    mockReadCacheEntry.mockResolvedValue(null);

    const result = await peekSamsMatches({ range: "future" });

    expect(result).toBeNull();
    expect(mockReadCacheEntry).toHaveBeenCalledTimes(1);
  });

  it("uses the unscoped cache entry without querying synced season", async () => {
    const cached = { matches: [{ uuid: "match-1" }], timestamp: "2026-07-21T08:00:00.000Z" };
    mockReadCacheEntry.mockResolvedValueOnce(cached);

    const result = await peekSamsMatches({ range: "future" });

    expect(result).toEqual(cached);
    expect(mockGetAllSamsTeams).not.toHaveBeenCalled();
    expect(mockReadCacheEntry).toHaveBeenCalledTimes(1);
  });
});
