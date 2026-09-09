import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/lib/sams/repositories", () => ({
  samsScheduleProjectionRepository: { listMatchesForSportsclubs: vi.fn(), get: vi.fn() },
  samsRankingProjectionRepository: { get: vi.fn() },
  appTabelleRepository: { listByDataset: vi.fn(), replaceDataset: vi.fn() },
  appTermineRepository: { listByDataset: vi.fn(), query: vi.fn(), replaceDataset: vi.fn() },
}));
vi.mock("@webapp/server/queries", () => ({ getAllSamsClubs: vi.fn(), getAllSamsTeams: vi.fn() }));

import { appTermineRepository } from "@/lib/sams/repositories";
import { handleLoadSamsMatchesForSsr } from "./sams.server";

const mockAppTermineQuery = vi.mocked(appTermineRepository.query);

describe("handleLoadSamsMatchesForSsr", () => {
  beforeEach(() => {
    mockAppTermineQuery.mockResolvedValue([
      {
        datasetId: "current",
        matchSortKey: "F#2026-02-01#m1",
        type: "apptermine",
        matchUuid: "m1",
        date: "2026-02-01",
        team1: { uuid: "t1", name: "Team 1" },
        team2: { uuid: "t2", name: "Team 2" },
        hasResult: false,
        isHomeGame: true,
        ownedTeamUuids: ["t1"],
        updatedAt: "2026-01-01T00:00:00.000Z",
        ttl: 1,
      },
    ]);
  });

  it("returns hook options from the application Termine read model", async () => {
    const result = await handleLoadSamsMatchesForSsr({ range: "future" });
    expect(result.hookOptions.range).toBe("future");
    expect(result.cached?.matches).toHaveLength(1);
    expect(result.hookOptions.season).toBeUndefined();
  });
});
