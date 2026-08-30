import type { ClubResponse, TeamResponse } from "@/lib/db/schemas";
import type { LeagueMatch } from "@/lambda/sams/types";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  buildLiveMatchesFromRaw,
  handleGetSamsMatches,
  handleGetSamsRankingByLeagueUuid,
  handlePeekSamsMatchesCache,
  resolveClubLogoUrl,
} from "./sams.server";

vi.mock("@/lib/sams/repositories", () => ({
  samsScheduleProjectionRepository: { listMatchesForSportsclubs: vi.fn(), get: vi.fn() },
  samsRankingProjectionRepository: { get: vi.fn() },
}));
vi.mock("@webapp/server/queries", () => ({ getAllSamsClubs: vi.fn(), getAllSamsTeams: vi.fn() }));

import {
  samsRankingProjectionRepository,
  samsScheduleProjectionRepository,
} from "@/lib/sams/repositories";
import { getAllSamsClubs, getAllSamsTeams } from "@webapp/server/queries";

const mockList = vi.mocked(samsScheduleProjectionRepository.listMatchesForSportsclubs);
const mockRankingGet = vi.mocked(samsRankingProjectionRepository.get);
const mockClubs = vi.mocked(getAllSamsClubs);
const mockTeams = vi.mocked(getAllSamsTeams);

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
const team: TeamResponse = {
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
};

function sampleMatch(overrides: Partial<LeagueMatch> = {}): LeagueMatch {
  return {
    uuid: "m1",
    date: "2026-12-01",
    hasResult: false,
    team1: { uuid: "t1", name: "Team 1", sportsclubUuid: "uuid-a" },
    team2: { uuid: "t2", name: "Team 2", sportsclubUuid: "uuid-b" },
    ...overrides,
  };
}

describe("projection reads", () => {
  beforeEach(() => {
    mockClubs.mockResolvedValue({ items: clubs });
    mockTeams.mockResolvedValue({ items: [team] });
    mockList.mockReset();
    mockRankingGet.mockReset();
  });

  it("loads projections", async () => {
    mockList.mockResolvedValue([sampleMatch()]);
    expect((await handlePeekSamsMatchesCache({ range: "future" }))?.matches).toHaveLength(1);
  });

  it("filters future matches by hasResult", async () => {
    mockList.mockResolvedValue([
      sampleMatch({ uuid: "f1", date: "2026-12-01", hasResult: false }),
      sampleMatch({ uuid: "p1", date: "2026-01-01", hasResult: true }),
    ]);
    expect((await handleGetSamsMatches({ range: "future" })).matches.map((m) => m.uuid)).toEqual([
      "f1",
    ]);
  });

  it("loads matches from both configured clubs", async () => {
    mockList.mockImplementation(async (sportsclubUuids) => {
      expect([...sportsclubUuids]).toEqual(expect.arrayContaining(["uuid-a", "uuid-b"]));
      return [
        sampleMatch({
          uuid: "a1",
          team1: { uuid: "team-a", name: "VCM", sportsclubUuid: "uuid-a" },
        }),
        sampleMatch({
          uuid: "b1",
          team1: { uuid: "team-b", name: "MGV", sportsclubUuid: "uuid-b" },
        }),
      ];
    });

    const result = await handleGetSamsMatches({ range: "future" });
    expect(result.matches.map((match) => match.uuid).sort()).toEqual(["a1", "b1"]);
  });

  it("returns an empty ranking payload when no projection exists", async () => {
    mockRankingGet.mockResolvedValue(null);
    const result = await handleGetSamsRankingByLeagueUuid("league-missing");
    expect(result.teams).toEqual([]);
    expect(result.leagueUuid).toBe("league-missing");
  });

  it("returns an empty ranking payload when no synced season exists", async () => {
    mockTeams.mockResolvedValue({ items: [] });
    const result = await handleGetSamsRankingByLeagueUuid("league-1");
    expect(result.teams).toEqual([]);
    expect(mockRankingGet).not.toHaveBeenCalled();
  });

  it("returns ranking rows including provider logoUrl", async () => {
    mockRankingGet.mockResolvedValue({
      leagueUuid: "l1",
      seasonUuid: "season-synced",
      seasonName: "25/26",
      leagueName: "BL",
      type: "ranking",
      teams: [
        {
          uuid: "t1",
          teamName: "VC",
          rank: 1,
          logoUrl: "https://cdn.example.com/logo.png",
        },
      ],
      snapshotVersion: "abc",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ttl: 1,
    });
    const result = await handleGetSamsRankingByLeagueUuid("l1");
    expect(result.teams?.[0]?.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(result.leagueName).toBe("BL");
  });
});

describe("resolveClubLogoUrl", () => {
  it("returns the provider logo URL", () => {
    expect(resolveClubLogoUrl({ logoImageLink: "https://cdn.example.com/x.png" })).toBe(
      "https://cdn.example.com/x.png",
    );
  });

  it("returns null without a provider logo", () => {
    expect(resolveClubLogoUrl({ logoImageLink: null })).toBeNull();
  });
});

describe("buildLiveMatchesFromRaw", () => {
  it("returns empty without states", () => {
    expect(buildLiveMatchesFromRaw({ matchDays: [], matchStates: {} })).toHaveLength(0);
  });
});
