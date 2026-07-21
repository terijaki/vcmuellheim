import type { ClubResponse } from "@/lambda/sams/types";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createSamsMatchesCacheKey,
  resolveSamsMatchesQuery,
} from "@/app/src/server/sams/match-loader.server";

vi.mock("@/app/src/server/queries", () => ({
  getAllSamsClubs: vi.fn(),
  getAllSamsTeams: vi.fn(),
}));

vi.mock("@/app/src/server/ddb-cache", () => ({
  readCacheEntry: vi.fn(),
  writeCacheEntry: vi.fn(),
}));

import { getAllSamsClubs } from "@/app/src/server/queries";

const mockGetAllSamsClubs = vi.mocked(getAllSamsClubs);

describe("createSamsMatchesCacheKey", () => {
  it("includes resolved sportsclub UUIDs in the cache key", () => {
    const key = createSamsMatchesCacheKey({ range: "future", limit: 5 }, ["club-a", "club-b"]);

    expect(key).toContain("sams_matches");
    expect(key).toContain("club-a");
    expect(key).toContain("club-b");
    expect(key).toContain("future");
  });
});

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
    const clubs: ClubResponse[] = [
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
    mockGetAllSamsClubs.mockResolvedValue({ items: clubs });

    const result = await resolveSamsMatchesQuery({ range: "future", limit: 10 });

    expect(result?.effectiveSportsclubUuids.sort()).toEqual(["uuid-a", "uuid-b"]);
    expect(result?.cacheKey).toContain("uuid-a");
  });
});
