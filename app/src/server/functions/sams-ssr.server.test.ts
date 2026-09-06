import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/lib/sams/repositories", () => ({
  samsScheduleProjectionRepository: { listMatchesForSportsclubs: vi.fn(), get: vi.fn() },
  samsRankingProjectionRepository: { get: vi.fn() },
}));
vi.mock("@webapp/server/queries", () => ({ getAllSamsClubs: vi.fn(), getAllSamsTeams: vi.fn() }));

import { samsScheduleProjectionRepository } from "@/lib/sams/repositories";
import { getAllSamsClubs, getAllSamsTeams } from "@webapp/server/queries";
import { handleLoadSamsMatchesForSsr } from "./sams.server";

const mockList = vi.mocked(samsScheduleProjectionRepository.listMatchesForSportsclubs);

describe("handleLoadSamsMatchesForSsr", () => {
  beforeEach(() => {
    vi.mocked(getAllSamsClubs).mockResolvedValue({
      items: [
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
      ],
    });
    vi.mocked(getAllSamsTeams).mockResolvedValue({
      items: [
        {
          type: "team",
          uuid: "team-1",
          name: "VC",
          sportsclubUuid: "uuid-a",
          associationUuid: "a",
          leagueUuid: "l1",
          leagueName: "BL",
          seasonUuid: "season-synced",
          seasonName: "25/26",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    mockList.mockResolvedValue([
      {
        uuid: "m1",
        date: "2026-02-01",
        hasResult: false,
        team1: { uuid: "t1", name: "Team 1" },
        team2: { uuid: "t2", name: "Team 2" },
      },
    ]);
  });

  it("returns hook options from projection peek", async () => {
    const result = await handleLoadSamsMatchesForSsr({ range: "future" });
    expect(result.hookOptions.season).toBe("season-synced");
  });
});
