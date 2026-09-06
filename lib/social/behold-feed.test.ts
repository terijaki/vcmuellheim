import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BeholdPost } from "@/lambda/social/types";
import { BEHOLD_FEED_PK, BEHOLD_FEED_SK } from "./behold-feed";

const ddbMock = mockClient(DynamoDBDocumentClient);

const samplePost: BeholdPost = {
  id: "post-1",
  timestamp: "2026-08-01T12:00:00.000Z",
  permalink: "https://instagram.com/p/abc",
  mediaType: "IMAGE",
  mediaUrl: "https://cdn.example.com/photo.jpg",
  sizes: {
    small: { mediaUrl: "https://cdn.example.com/s.jpg", height: 100, width: 100 },
    medium: { mediaUrl: "https://cdn.example.com/m.jpg", height: 400, width: 400 },
    large: { mediaUrl: "https://cdn.example.com/l.jpg", height: 800, width: 800 },
    full: { mediaUrl: "https://cdn.example.com/f.jpg", height: 1200, width: 1200 },
  },
  caption: "Matchday",
  prunedCaption: "Matchday",
  hashtags: ["vcm"],
  mentions: [],
  colorPalette: {
    dominant: "#000000",
    muted: "#111111",
    mutedLight: "#222222",
    mutedDark: "#333333",
    vibrant: "#444444",
    vibrantLight: "#555555",
    vibrantDark: "#666666",
  },
};

let beholdFeedRepository: typeof import("./behold-feed").beholdFeedRepository;

describe("BeholdFeedRepository", () => {
  beforeAll(async () => {
    process.env.SOCIAL_TABLE_NAME = "test-social-table";
    ({ beholdFeedRepository } = await import("./behold-feed"));
  });

  beforeEach(() => {
    ddbMock.reset();
  });

  it("writes posts to social#behold / feed and reads them back", async () => {
    ddbMock.on(PutCommand).resolves({});
    await beholdFeedRepository.writePosts(
      [samplePost],
      3600,
      Date.parse("2026-08-30T00:00:00.000Z"),
    );

    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.TableName).toBe("test-social-table");
    expect(put?.Item).toMatchObject({
      pk: BEHOLD_FEED_PK,
      sk: BEHOLD_FEED_SK,
      cachedAt: "2026-08-30T00:00:00.000Z",
    });
    expect(put?.Item?.pk).toBe("social#behold");
    expect(put?.Item?.sk).toBe("feed");

    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: BEHOLD_FEED_PK,
        sk: BEHOLD_FEED_SK,
        data: JSON.stringify([samplePost]),
        cachedAt: "2026-08-30T00:00:00.000Z",
        ttl: 1_000_000,
      },
    });

    const posts = await beholdFeedRepository.readPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.id).toBe("post-1");

    const get = ddbMock.commandCalls(GetCommand)[0]?.args[0].input;
    expect(get).toMatchObject({
      TableName: "test-social-table",
      Key: { pk: "social#behold", sk: "feed" },
    });
  });

  it("returns an empty list when the feed item is missing", async () => {
    ddbMock.on(GetCommand).resolves({});
    expect(await beholdFeedRepository.readPosts()).toEqual([]);
  });
});
