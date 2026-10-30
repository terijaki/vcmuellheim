import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { AppTermineRepository } from "./app-termine-repository";

const ddbMock = mockClient(DynamoDBDocumentClient);

function matchItem(overrides: Record<string, unknown> = {}) {
  return {
    pk: "appTermine#current",
    sk: "F#2026-10-01#m1",
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
    ddbMock.reset();
    process.env.SAMS_TABLE_NAME = "sams-test";
  });

  it("queries future matches with DynamoDB limit instead of loading the full partition", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [matchItem()], LastEvaluatedKey: undefined });

    const repo = new AppTermineRepository(ddbMock as never, "sams-test");
    const matches = await repo.query({ range: "future", limit: 1 });

    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.ExpressionAttributeValues?.[":prefix"]).toBe("F#");
    expect(call?.Limit).toBe(1);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchUuid).toBe("m1");
  });

  it("applies homeOnly via FilterExpression and stops once the limit is filled", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [matchItem()],
      LastEvaluatedKey: { pk: "appTermine#current", sk: "F#next" },
    });

    const repo = new AppTermineRepository(ddbMock as never, "sams-test");
    const matches = await repo.query({ range: "future", homeOnly: true, limit: 1 });

    expect(matches).toHaveLength(1);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
  });

  it("filters by teamUuid across pages without requiring a full partition load first", async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [matchItem({ team1: { uuid: "other", name: "X" } })],
        LastEvaluatedKey: { pk: "appTermine#current", sk: "F#c1" },
      })
      .resolvesOnce({ Items: [matchItem()], LastEvaluatedKey: undefined });

    const repo = new AppTermineRepository(ddbMock as never, "sams-test");
    const matches = await repo.query({ teamUuid: "t1", limit: 1 });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.team1.uuid).toBe("t1");
    expect(ddbMock.commandCalls(QueryCommand).length).toBeGreaterThan(1);
  });
});

describe("AppTermineRepository.replaceDataset", () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.SAMS_TABLE_NAME = "sams-test";
  });

  it("writes native DynamoDB items", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    const repo = new AppTermineRepository(ddbMock as never, "sams-test");
    await repo.replaceDataset("current", [
      {
        datasetId: "current",
        matchSortKey: "F#2026-10-01#m1",
        matchUuid: "m1",
        team1: { uuid: "t1", name: "A" },
        team2: { uuid: "t2", name: "B" },
        hasResult: false,
        isHomeGame: true,
        ownedTeamUuids: ["t1"],
      },
    ]);

    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.Item?.pk).toBe("appTermine#current");
    expect(put?.Item?.sk).toBe("F#2026-10-01#m1");
  });
});
