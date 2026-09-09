import { describe, expect, it, vi } from "vite-plus/test";
import type { SamsRepositories } from "@/lib/sams/repositories/create-sams-repositories";
import { rebuildAppProjections } from "./rebuild-app-projections";

function createRepos(overrides: Partial<SamsRepositories> = {}): SamsRepositories {
  return {
    clubs: {
      listAll: vi
        .fn()
        .mockResolvedValue([
          { sportsclubUuid: "club-vcm", name: "VC Müllheim", nameSlug: "vc-muellheim" },
        ]),
      getById: vi.fn(),
      getByNameSlug: vi.fn(),
      queryByNameSlugPrefix: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      upsertMany: vi.fn(),
    },
    teams: {
      listAll: vi.fn().mockResolvedValue([
        {
          uuid: "team-vcm-1",
          sportsclubUuid: "club-vcm",
          leagueUuid: "league-1",
          leagueName: "Bezirksliga",
          leagueHierarchyLevel: 4,
          seasonUuid: "season-26",
          seasonName: "2026/27",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      ]),
      getById: vi.fn(),
      getByNameSlug: vi.fn(),
      queryByNameSlugPrefix: vi.fn(),
      upsert: vi.fn(),
      upsertMany: vi.fn(),
      delete: vi.fn(),
    },
    rosters: {
      getByTeamUuid: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    schedules: {
      get: vi.fn(),
      getSnapshotVersion: vi.fn(),
      replace: vi.fn(),
      mergeMatchesForClub: vi.fn(),
      listMatchesForSportsclubs: vi.fn().mockResolvedValue([
        {
          uuid: "match-1",
          date: "2026-10-01T18:00:00.000Z",
          leagueUuid: "league-1",
          seasonUuid: "season-26",
          team1: { uuid: "team-vcm-1", name: "VC", sportsclubUuid: "club-vcm" },
          team2: { uuid: "team-opp", name: "Opp", sportsclubUuid: "club-opp" },
          hasResult: false,
        },
      ]),
    },
    rankings: {
      get: vi.fn().mockResolvedValue({
        leagueUuid: "league-1",
        seasonUuid: "season-26",
        leagueName: "Bezirksliga",
        seasonName: "2026/27",
        teams: [
          {
            uuid: "team-vcm-1",
            teamName: "VC Müllheim 1",
            rank: 1,
            sportsclubUuid: "club-vcm",
            points: 6,
          },
        ],
      }),
      replace: vi.fn(),
    },
    appTabelle: {
      listByDataset: vi.fn().mockResolvedValue([]),
      replaceDataset: vi.fn().mockResolvedValue([]),
    },
    appTermine: {
      listByDataset: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      replaceDataset: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe("rebuildAppProjections", () => {
  it("writes current Tabelle and Termine datasets from canonical SAMS projections", async () => {
    const repos = createRepos();
    const result = await rebuildAppProjections(repos);

    expect(result).toEqual({
      seasonUuid: "season-26",
      tabelleLeagueCount: 1,
      termineMatchCount: 1,
    });
    expect(repos.appTabelle.replaceDataset).toHaveBeenCalledTimes(2);
    expect(repos.appTermine.replaceDataset).toHaveBeenCalledTimes(2);

    const [currentTabelleDataset, currentTabelleRows] = (
      repos.appTabelle.replaceDataset as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(currentTabelleDataset).toBe("current");
    expect(currentTabelleRows[0].leagueUuid).toBe("league-1");
    expect(currentTabelleRows[0].ownedTeamUuids).toEqual(["team-vcm-1"]);

    const [currentTermineDataset, currentTermineRows] = (
      repos.appTermine.replaceDataset as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(currentTermineDataset).toBe("current");
    expect(currentTermineRows[0].matchUuid).toBe("match-1");
    expect(currentTermineRows[0].leagueName).toBe("Bezirksliga");
    expect(currentTermineRows[0].isHomeGame).toBe(true);
  });

  it("clears current datasets when season or configured clubs are unresolved", async () => {
    const repos = createRepos({
      teams: {
        listAll: vi.fn().mockResolvedValue([]),
        getById: vi.fn(),
        getByNameSlug: vi.fn(),
        queryByNameSlugPrefix: vi.fn(),
        upsert: vi.fn(),
        upsertMany: vi.fn(),
        delete: vi.fn(),
      },
    });

    const result = await rebuildAppProjections(repos);
    expect(result.seasonUuid).toBeNull();
    expect(repos.appTabelle.replaceDataset).toHaveBeenCalledWith("current", []);
    expect(repos.appTermine.replaceDataset).toHaveBeenCalledWith("current", []);
  });
});
