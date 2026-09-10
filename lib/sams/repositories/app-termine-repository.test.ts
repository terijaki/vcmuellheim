import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const goMock = vi.fn();
const beginsMock = vi.fn(() => ({ where: whereMock, go: goMock }));
const whereMock = vi.fn(() => ({ go: goMock }));
const byDatasetMock = vi.fn(() => ({ begins: beginsMock, where: whereMock, go: goMock }));
const putGoMock = vi.fn().mockResolvedValue(undefined);
const deleteGoMock = vi.fn().mockResolvedValue(undefined);
const putMock = vi.fn(() => ({ go: putGoMock }));
const deleteMock = vi.fn(() => ({ go: deleteGoMock }));

vi.mock("@/lib/db/electrodb-client", () => ({
  createSamsDb: () => ({
    appTermine: {
      query: { byDataset: byDatasetMock },
      put: putMock,
      delete: deleteMock,
    },
  }),
}));

vi.mock("@/lib/db/env", () => ({
  getSamsTableName: () => "sams-test",
}));

import { AppTermineRepository } from "./app-termine-repository";

function matchItem(overrides: Record<string, unknown> = {}) {
  return {
    datasetId: "current",
    matchSortKey: "F#2026-10-01#m1",
    type: "apptermine",
    matchUuid: "m1",
    date: "2026-10-01",
    team1: { uuid: "t1", name: "A" },
    team2: { uuid: "t2", name: "B" },
    hasResult: false,
    isHomeGame: true,
    ownedTeamUuids: ["t1"],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ttl: 1,
    ...overrides,
  };
}

describe("AppTermineRepository.query", () => {
  beforeEach(() => {
    goMock.mockReset();
    beginsMock.mockClear();
    whereMock.mockClear();
    byDatasetMock.mockClear();
  });

  it("queries future matches with DynamoDB limit instead of loading the full partition", async () => {
    goMock.mockResolvedValueOnce({ data: [matchItem()], cursor: null });

    const repo = new AppTermineRepository();
    const matches = await repo.query({ range: "future", limit: 1 });

    expect(beginsMock).toHaveBeenCalledWith({ matchSortKey: "F#" });
    expect(goMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1, pages: 1, order: "asc" }),
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchUuid).toBe("m1");
  });

  it("applies homeOnly via FilterExpression and stops once the limit is filled", async () => {
    goMock.mockResolvedValueOnce({ data: [matchItem()], cursor: "next" });

    const repo = new AppTermineRepository();
    const matches = await repo.query({ range: "future", homeOnly: true, limit: 1 });

    expect(whereMock).toHaveBeenCalled();
    expect(matches).toHaveLength(1);
    expect(goMock).toHaveBeenCalledTimes(1);
  });

  it("filters by teamUuid across pages without requiring a full partition load first", async () => {
    goMock
      .mockResolvedValueOnce({
        data: [
          matchItem({
            matchUuid: "other",
            matchSortKey: "F#2026-10-01#other",
            team1: { uuid: "x", name: "X" },
            team2: { uuid: "y", name: "Y" },
            isHomeGame: false,
            ownedTeamUuids: [],
          }),
        ],
        cursor: "page-2",
      })
      .mockResolvedValueOnce({
        data: [
          matchItem({
            matchUuid: "wanted",
            matchSortKey: "F#2026-10-02#wanted",
            date: "2026-10-02",
            team1: { uuid: "team-a", name: "A" },
            team2: { uuid: "opp", name: "Opp" },
            ownedTeamUuids: ["team-a"],
          }),
        ],
        cursor: null,
      });

    const repo = new AppTermineRepository();
    const matches = await repo.query({ range: "future", teamUuid: "team-a", limit: 1 });

    expect(matches.map((match) => match.matchUuid)).toEqual(["wanted"]);
    expect(goMock).toHaveBeenCalledTimes(2);
  });
});

describe("AppTermineRepository.replaceDataset", () => {
  beforeEach(() => {
    goMock.mockReset();
    putMock.mockClear();
    deleteMock.mockClear();
    putGoMock.mockClear();
    deleteGoMock.mockClear();
  });

  it("deletes stale sort keys when a match moves from future to past", async () => {
    goMock.mockResolvedValueOnce({
      data: [matchItem({ matchSortKey: "F#2026-10-01#m1", hasResult: false })],
    });

    const repo = new AppTermineRepository();
    await repo.replaceDataset("current", [
      {
        datasetId: "current",
        matchSortKey: "P#2026-10-01#m1",
        matchUuid: "m1",
        date: "2026-10-01",
        team1: { uuid: "t1", name: "A" },
        team2: { uuid: "t2", name: "B" },
        hasResult: true,
        isHomeGame: true,
        ownedTeamUuids: ["t1"],
      },
    ]);

    expect(deleteMock).toHaveBeenCalledWith({
      datasetId: "current",
      matchSortKey: "F#2026-10-01#m1",
    });
    expect(putMock).toHaveBeenCalled();
  });
});
