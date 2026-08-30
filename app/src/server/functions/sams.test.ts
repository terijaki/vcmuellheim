import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  buildLiveMatchesFromRaw,
  handleGetSamsMatches,
  handlePeekSamsMatchesCache,
  resolveClubLogoUrl,
} from "./sams.server";

vi.mock("@/lib/sams/repositories", () => ({
  samsScheduleProjectionRepository: { listMatchesForSportsclubs: vi.fn(), get: vi.fn() },
  samsRankingProjectionRepository: { get: vi.fn() },
}));
vi.mock("@webapp/server/queries", () => ({ getAllSamsClubs: vi.fn(), getAllSamsTeams: vi.fn() }));

import { samsScheduleProjectionRepository } from "@/lib/sams/repositories";
import { getAllSamsClubs, getAllSamsTeams } from "@webapp/server/queries";

const mockList = vi.mocked(samsScheduleProjectionRepository.listMatchesForSportsclubs);
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

describe("projection reads", () => {
  beforeEach(() => {
    mockClubs.mockResolvedValue({ items: clubs });
    mockTeams.mockResolvedValue({ items: [team] });
    mockList.mockReset();
  });

  it("loads projections", async () => {
    mockList.mockResolvedValue([{ uuid: "m1", date: "2026-12-01", results: null, host: null }]);
    expect((await handlePeekSamsMatchesCache({ range: "future" }))?.matches).toHaveLength(1);
  });

  it("filters future matches", async () => {
    mockList.mockResolvedValue([
      { uuid: "f1", date: "2026-12-01", results: null, host: null },
      { uuid: "p1", date: "2026-01-01", results: { winner: "a" }, host: null },
    ]);
    expect((await handleGetSamsMatches({ range: "future" })).matches.map((m) => m.uuid)).toEqual([
      "f1",
    ]);
  });
});

describe("resolveClubLogoUrl", () => {
  it("returns cloudfront url", () => {
    expect(resolveClubLogoUrl({ logoS3Key: "x.png" }, "https://cdn.example.com")).toBe(
      "https://cdn.example.com/x.png",
    );
  });
});

describe("buildLiveMatchesFromRaw", () => {
  it("returns empty without states", () => {
    expect(buildLiveMatchesFromRaw({ matchDays: [], matchStates: {} })).toHaveLength(0);
  });
});
