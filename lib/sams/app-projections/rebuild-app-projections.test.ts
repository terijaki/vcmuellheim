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

  it("publishes a new current season while retaining the previous season dataset id", async () => {
    const repos = createRepos({
      teams: {
        listAll: vi.fn().mockResolvedValue([
          {
            uuid: "team-old",
            sportsclubUuid: "club-vcm",
            leagueUuid: "league-1",
            leagueName: "Bezirksliga",
            leagueHierarchyLevel: 4,
            seasonUuid: "season-25",
            seasonName: "2025/26",
            updatedAt: "2025-09-01T00:00:00.000Z",
          },
          {
            uuid: "team-new-1",
            sportsclubUuid: "club-vcm",
            leagueUuid: "league-1",
            leagueName: "Bezirksliga",
            leagueHierarchyLevel: 4,
            seasonUuid: "season-26",
            seasonName: "2026/27",
            updatedAt: "2026-09-01T00:00:00.000Z",
          },
          {
            uuid: "team-new-2",
            sportsclubUuid: "club-vcm",
            leagueUuid: "league-2",
            leagueName: "Landesliga",
            leagueHierarchyLevel: 3,
            seasonUuid: "season-26",
            seasonName: "2026/27",
            updatedAt: "2026-09-02T00:00:00.000Z",
          },
        ]),
        getById: vi.fn(),
        getByNameSlug: vi.fn(),
        queryByNameSlugPrefix: vi.fn(),
        upsert: vi.fn(),
        upsertMany: vi.fn(),
        delete: vi.fn(),
      },
      rankings: {
        get: vi.fn().mockImplementation(async (leagueUuid: string, seasonUuid: string) => ({
          leagueUuid,
          seasonUuid,
          leagueName: leagueUuid === "league-2" ? "Landesliga" : "Bezirksliga",
          seasonName: "2026/27",
          teams: [
            {
              uuid: "team-new-1",
              teamName: "VC",
              rank: 1,
              sportsclubUuid: "club-vcm",
              points: 3,
            },
          ],
        })),
        replace: vi.fn(),
      },
      schedules: {
        get: vi.fn(),
        getSnapshotVersion: vi.fn(),
        replace: vi.fn(),
        mergeMatchesForClub: vi.fn(),
        listMatchesForSportsclubs: vi.fn().mockResolvedValue([
          {
            uuid: "match-new",
            date: "2026-10-01T18:00:00.000Z",
            leagueUuid: "league-1",
            seasonUuid: "season-26",
            team1: { uuid: "team-new-1", name: "VC", sportsclubUuid: "club-vcm" },
            team2: { uuid: "team-opp", name: "Opp", sportsclubUuid: "club-opp" },
            hasResult: false,
          },
        ]),
      },
    });

    const result = await rebuildAppProjections(repos);
    expect(result.seasonUuid).toBe("season-26");

    const tabelleCalls = (repos.appTabelle.replaceDataset as ReturnType<typeof vi.fn>).mock.calls;
    const termineCalls = (repos.appTermine.replaceDataset as ReturnType<typeof vi.fn>).mock.calls;
    expect(tabelleCalls.map((call) => call[0])).toEqual(["current", "season#season-26"]);
    expect(termineCalls.map((call) => call[0])).toEqual(["current", "season#season-26"]);
    expect(tabelleCalls[0][1][0].seasonUuid).toBe("season-26");
    // Prior season partitions are not deleted — only current + new season copy are written.
    expect(tabelleCalls.some((call) => call[0] === "season#season-25")).toBe(false);
  });
});
