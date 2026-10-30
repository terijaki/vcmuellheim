import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import type { News } from "@/lib/db/types";

const ddbMock = mockClient(DynamoDBDocumentClient);

let getAllNews: typeof import("./queries").getAllNews;
let getPublishedNews: typeof import("./queries").getPublishedNews;
let getNewsBySlug: typeof import("./queries").getNewsBySlug;
let getAllSamsClubs: typeof import("./queries").getAllSamsClubs;
let getSamsClubBySportsclubUuid: typeof import("./queries").getSamsClubBySportsclubUuid;
let getSamsTeamByUuid: typeof import("./queries").getSamsTeamByUuid;
let getSamsRosterByTeamUuid: typeof import("./queries").getSamsRosterByTeamUuid;

describe("server/queries", () => {
  beforeAll(async () => {
    process.env.CONTENT_TABLE_NAME = "test-content-table";
    process.env.SAMS_TABLE_NAME = "test-sams-table";

    const q = await import("./queries");
    getAllNews = q.getAllNews;
    getPublishedNews = q.getPublishedNews;
    getNewsBySlug = q.getNewsBySlug;
    getAllSamsClubs = q.getAllSamsClubs;
    getSamsClubBySportsclubUuid = q.getSamsClubBySportsclubUuid;
    getSamsTeamByUuid = q.getSamsTeamByUuid;
    getSamsRosterByTeamUuid = q.getSamsRosterByTeamUuid;
  });

  beforeEach(() => {
    ddbMock.reset();
  });

  describe("getAllNews", () => {
    it("merges news status partitions via GSI1", async () => {
      const mockItem = {
        pk: "news#11111111-1111-4111-8111-111111111111",
        sk: "news",
        gsi1pk: "news#published",
        gsi1sk: "2024-01-02T00:00:00Z",
        id: "11111111-1111-4111-8111-111111111111",
        type: "article",
        title: "A",
        slug: "a",
        content: "c",
        status: "published",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      };
      ddbMock.on(QueryCommand).resolves({ Items: [mockItem] });

      const result = await getAllNews(10);

      expect(result.items).toHaveLength(3);
      expect(result.items.every((item) => item.id === mockItem.id)).toBe(true);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls.length).toBeGreaterThanOrEqual(3);
      const gsi1Pks = calls.map(
        (call) => call.args[0].input.ExpressionAttributeValues?.[":pk"] as string,
      );
      expect(gsi1Pks).toEqual(
        expect.arrayContaining(["news#draft", "news#published", "news#archived"]),
      );
      expect(calls[0].args[0].input).toMatchObject({
        TableName: "test-content-table",
        IndexName: "GSI1-ByTypeAndDate",
        ScanIndexForward: false,
        Limit: 1,
      });
    });
  });

  describe("getPublishedNews", () => {
    it("queries GSI1 with news#published partition", async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await getPublishedNews(5);

      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input).toMatchObject({
        TableName: "test-content-table",
        IndexName: "GSI1-ByTypeAndDate",
        ScanIndexForward: false,
        Limit: 5,
        ExpressionAttributeValues: { ":pk": "news#published" },
      });
    });
  });

  describe("getNewsBySlug", () => {
    it("loads slug lookup then main item", async () => {
      const domainItem: News = {
        id: "33333333-3333-4333-8333-333333333333",
        type: "article",
        title: "Hello",
        slug: "hello",
        content: "c",
        status: "published",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      ddbMock
        .on(GetCommand)
        .resolvesOnce({
          Item: { pk: "news#slug#hello", sk: "news", id: domainItem.id, slug: "hello" },
        })
        .resolvesOnce({
          Item: {
            pk: `news#${domainItem.id}`,
            sk: "news",
            ...domainItem,
          },
        });

      const result = await getNewsBySlug("hello");

      expect(result).toEqual(domainItem);
      expect(ddbMock.commandCalls(GetCommand)).toHaveLength(2);
    });

    it("returns null when not found", async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });
      const result = await getNewsBySlug("unknown");
      expect(result).toBeNull();
    });
  });

  describe("getAllSamsClubs", () => {
    it("queries the SAMS table GSI1", async () => {
      const mockClubs = [
        {
          pk: "samsClub#c1",
          sk: "samsClub",
          gsi1pk: "samsClub",
          gsi1sk: "vc-muellheim",
          sportsclubUuid: "c1",
          type: "club",
          name: "VC Müllheim",
          nameSlug: "vc-muellheim",
          updatedAt: "2024-01-01T00:00:00Z",
          ttl: 123,
        },
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockClubs });

      const result = await getAllSamsClubs();

      expect(result.items).toHaveLength(1);
      const calls = ddbMock.commandCalls(QueryCommand);
      expect(calls[0].args[0].input.TableName).toBe("test-sams-table");
    });
  });

  describe("getSamsClubBySportsclubUuid", () => {
    it("gets club by primary key", async () => {
      const mockClub = {
        pk: "samsClub#c1",
        sk: "samsClub",
        sportsclubUuid: "c1",
        type: "club",
        name: "VC Müllheim",
        nameSlug: "vc-muellheim",
        updatedAt: "2024-01-01T00:00:00Z",
        ttl: 123,
      };
      ddbMock.on(GetCommand).resolves({ Item: mockClub });

      const result = await getSamsClubBySportsclubUuid("c1");

      expect(result).not.toBeNull();
      expect(result?.sportsclubUuid).toBe("c1");
    });
  });

  describe("getSamsTeamByUuid", () => {
    it("gets team by uuid primary key", async () => {
      const mockTeam = {
        pk: "samsTeam#t1",
        sk: "samsTeam",
        uuid: "t1",
        type: "team",
        name: "Damen 1",
        nameSlug: "damen-1",
        sportsclubUuid: "c1",
        associationUuid: "a1",
        leagueUuid: "l1",
        leagueName: "Liga A",
        seasonUuid: "s1",
        seasonName: "2024",
        updatedAt: "2024-01-01T00:00:00Z",
        ttl: 123,
      };
      ddbMock.on(GetCommand).resolves({ Item: mockTeam });

      const result = await getSamsTeamByUuid("t1");

      expect(result).not.toBeNull();
      expect(result?.uuid).toBe("t1");
    });
  });

  describe("getSamsRosterByTeamUuid", () => {
    it("gets roster by teamUuid primary key", async () => {
      const mockRoster = {
        pk: "samsRoster#t1",
        sk: "samsRoster",
        teamUuid: "t1",
        type: "roster",
        players: [{ uuid: "p1", name: "Jane Doe", jerseyNumber: 7, position: "Zuspiel" }],
        officials: [{ uuid: "o1", name: "Coach Smith", role: "Trainer" }],
        updatedAt: "2024-01-01T00:00:00Z",
        ttl: 123,
      };
      ddbMock.on(GetCommand).resolves({ Item: mockRoster });

      const result = await getSamsRosterByTeamUuid("t1");

      expect(result).not.toBeNull();
      expect(result?.teamUuid).toBe("t1");
    });
  });
});
