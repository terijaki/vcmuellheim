import type { ClubResponse, TeamResponse } from "@/lib/db/schemas";
import type { LeagueMatch } from "@/lambda/sams/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  buildLiveMatchesFromRaw,
  handleGetCurrentTabelle,
  handleGetCurrentTermine,
  handleGetSamsMatches,
  handleGetSamsRankingByLeagueUuid,
  handlePeekSamsMatchesCache,
  handleServeClubLogo,
} from "./sams.server";

vi.mock("@/lib/sams/repositories", () => ({
  samsScheduleProjectionRepository: { listMatchesForSportsclubs: vi.fn(), get: vi.fn() },
  samsRankingProjectionRepository: { get: vi.fn() },
  appTabelleRepository: { listByDataset: vi.fn(), replaceDataset: vi.fn() },
  appTermineRepository: { listByDataset: vi.fn(), query: vi.fn(), replaceDataset: vi.fn() },
}));
vi.mock("@webapp/server/queries", () => ({
  getAllSamsClubs: vi.fn(),
  getAllSamsTeams: vi.fn(),
  getSamsClubBySportsclubUuid: vi.fn(),
  getSamsRosterByTeamUuid: vi.fn(),
}));

import {
  appTabelleRepository,
  appTermineRepository,
  samsRankingProjectionRepository,
  samsScheduleProjectionRepository,
} from "@/lib/sams/repositories";
import {
  getAllSamsClubs,
  getAllSamsTeams,
  getSamsClubBySportsclubUuid,
} from "@webapp/server/queries";

const mockList = vi.mocked(samsScheduleProjectionRepository.listMatchesForSportsclubs);
const mockRankingGet = vi.mocked(samsRankingProjectionRepository.get);
const mockAppTabelleList = vi.mocked(appTabelleRepository.listByDataset);
const mockAppTermineQuery = vi.mocked(appTermineRepository.query);
const mockClubs = vi.mocked(getAllSamsClubs);
const mockTeams = vi.mocked(getAllSamsTeams);
const mockClubByUuid = vi.mocked(getSamsClubBySportsclubUuid);

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

function sampleAppTermine(overrides: Record<string, unknown> = {}) {
  return {
    datasetId: "current",
    matchSortKey: "F#2026-12-01#m1",
    type: "apptermine" as const,
    matchUuid: "m1",
    date: "2026-12-01",
    leagueUuid: "l1",
    leagueName: "BL",
    seasonUuid: "season-synced",
    team1: { uuid: "t1", name: "Team 1", sportsclubUuid: "uuid-a" },
    team2: { uuid: "t2", name: "Team 2", sportsclubUuid: "uuid-b" },
    hasResult: false,
    isHomeGame: true,
    ownedTeamUuids: ["t1"],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ttl: 1,
    ...overrides,
  };
}

describe("application read models", () => {
  beforeEach(() => {
    mockClubs.mockResolvedValue({ items: clubs });
    mockTeams.mockResolvedValue({ items: [team] });
    mockList.mockReset();
    mockRankingGet.mockReset();
    mockAppTabelleList.mockReset();
    mockAppTermineQuery.mockReset();
    mockAppTabelleList.mockResolvedValue([]);
    mockAppTermineQuery.mockResolvedValue([]);
  });

  it("reads current Termine without club/season discovery", async () => {
    mockAppTermineQuery.mockResolvedValue([sampleAppTermine()]);
    const result = await handleGetCurrentTermine({ range: "future" });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.uuid).toBe("m1");
    expect(result.ownedTeamUuids).toEqual(["t1"]);
    expect(mockClubs).not.toHaveBeenCalled();
    expect(mockTeams).not.toHaveBeenCalled();
  });

  it("reads current Tabelle without season discovery", async () => {
    mockAppTabelleList.mockResolvedValue([
      {
        datasetId: "current",
        leagueSortKey: "00004#l1",
        type: "apptabelle",
        leagueUuid: "l1",
        leagueName: "BL",
        seasonUuid: "season-synced",
        seasonName: "25/26",
        teams: [
          {
            uuid: "t1",
            teamName: "VC",
            rank: 1,
            sportsclubUuid: "club-1",
            logoUrl: "https://cdn.example.com/logo.png",
          },
        ],
        ownedTeamUuids: ["t1"],
        updatedAt: "2026-01-01T00:00:00.000Z",
        ttl: 1,
      },
    ]);

    const result = await handleGetCurrentTabelle();
    expect(result.leagueUuids).toEqual(["l1"]);
    expect(result.rankingsByLeagueUuid.l1?.teams?.[0]?.logoUrl).toBe(
      "/api/sams/logos?clubUuid=club-1",
    );
    expect(mockTeams).not.toHaveBeenCalled();
  });

  it("uses Termine read model for default match queries", async () => {
    mockAppTermineQuery.mockResolvedValue([
      sampleAppTermine({ matchUuid: "f1", matchSortKey: "F#2026-12-01#f1", hasResult: false }),
    ]);
    expect((await handlePeekSamsMatchesCache({ range: "future" }))?.matches).toHaveLength(1);
    expect((await handleGetSamsMatches({ range: "future" })).matches.map((m) => m.uuid)).toEqual([
      "f1",
    ]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("filters Termine by team UUID via the application read model", async () => {
    mockAppTermineQuery.mockResolvedValue([
      sampleAppTermine({
        matchUuid: "a1",
        team1: { uuid: "team-a", name: "VCM", sportsclubUuid: "uuid-a" },
        team2: { uuid: "opp", name: "Opp", sportsclubUuid: "uuid-b" },
      }),
      sampleAppTermine({
        matchUuid: "b1",
        matchSortKey: "F#2026-12-02#b1",
        team1: { uuid: "team-b", name: "MGV", sportsclubUuid: "uuid-b" },
        team2: { uuid: "opp", name: "Opp", sportsclubUuid: "uuid-a" },
      }),
    ]);

    const result = await handleGetSamsMatches({ team: "team-a" });
    expect(result.matches.map((match) => match.uuid)).toEqual(["a1"]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("returns ranking from application Tabelle when present", async () => {
    mockAppTabelleList.mockResolvedValue([
      {
        datasetId: "current",
        leagueSortKey: "00004#l1",
        type: "apptabelle",
        leagueUuid: "l1",
        leagueName: "BL",
        seasonUuid: "season-synced",
        seasonName: "25/26",
        teams: [
          {
            uuid: "t1",
            teamName: "VC",
            rank: 1,
            sportsclubUuid: "club-1",
            logoUrl: "https://cdn.example.com/logo.png",
          },
        ],
        ownedTeamUuids: ["t1"],
        updatedAt: "2026-01-01T00:00:00.000Z",
        ttl: 1,
      },
    ]);
    const result = await handleGetSamsRankingByLeagueUuid("l1");
    expect(result.teams?.[0]?.logoUrl).toBe("/api/sams/logos?clubUuid=club-1");
    expect(result.leagueName).toBe("BL");
    expect(mockRankingGet).not.toHaveBeenCalled();
  });

  it("falls back to canonical ranking when app Tabelle is empty", async () => {
    mockAppTabelleList.mockResolvedValue([]);
    mockRankingGet.mockResolvedValue({
      leagueUuid: "l1",
      seasonUuid: "season-synced",
      seasonName: "25/26",
      leagueName: "BL",
      type: "ranking",
      teams: [
        {
          uuid: "t2",
          teamName: "Hey Arnold",
          rank: 2,
          sportsclubUuid: "club-no-logo",
        },
      ],
      snapshotVersion: "abc",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ttl: 1,
    });
    const result = await handleGetSamsRankingByLeagueUuid("l1");
    expect(result.teams?.[0]?.logoUrl).toBeUndefined();
    expect(result.teams?.[0]?.sportsclubUuid).toBe("club-no-logo");
  });

  it("returns an empty ranking payload when no projection exists", async () => {
    mockAppTabelleList.mockResolvedValue([]);
    mockRankingGet.mockResolvedValue(null);
    const result = await handleGetSamsRankingByLeagueUuid("league-missing");
    expect(result.teams).toEqual([]);
    expect(result.leagueUuid).toBe("league-missing");
  });

  it("uses canonical schedule path when an explicit sportsclub filter is set", async () => {
    mockList.mockResolvedValue([sampleMatch({ uuid: "club-only" })]);
    const result = await handleGetSamsMatches({ sportsclub: "uuid-a", range: "future" });
    expect(result.matches.map((match) => match.uuid)).toEqual(["club-only"]);
    expect(mockList).toHaveBeenCalled();
  });
});

describe("handleServeClubLogo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams SVG bytes from a data URI stored on the club", async () => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg'></svg>";
    mockClubByUuid.mockResolvedValue({
      type: "club",
      name: "Mighty Ducks",
      sportsclubUuid: "club-1",
      logoImageLink: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await handleServeClubLogo("club-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml;charset=utf-8");
    expect(await response.text()).toBe(svg);
  });

  it("proxies https provider logos", async () => {
    mockClubByUuid.mockResolvedValue({
      type: "club",
      name: "VC Müllheim",
      sportsclubUuid: "club-1",
      logoImageLink: "https://cdn.example.com/logo.png",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Buffer.from("png-bytes"), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );

    const response = await handleServeClubLogo("club-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("png-bytes");
  });

  it("returns 404 when the club has no logo", async () => {
    mockClubByUuid.mockResolvedValue({
      type: "club",
      name: "VC Müllheim",
      sportsclubUuid: "club-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const response = await handleServeClubLogo("club-1");
    expect(response.status).toBe(404);
  });
});

describe("buildLiveMatchesFromRaw", () => {
  it("returns empty without states", () => {
    expect(buildLiveMatchesFromRaw({ matchDays: [], matchStates: {} })).toHaveLength(0);
  });
});
