import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { MATCH_MASTODON_SHARE_SK, matchMastodonSharePk } from "@/lib/db/schemas";
import { MatchMastodonShareRepository } from "./match-mastodon-share-repository";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("MatchMastodonShareRepository", () => {
  beforeAll(() => {
    process.env.SOCIAL_TABLE_NAME = "test-social-table";
  });

  beforeEach(() => {
    ddbMock.reset();
  });

  it("claims a match UUID with pending status and season-length TTL", async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = new MatchMastodonShareRepository(ddbMock as never, "test-social-table");

    const claimed = await repo.claim("match-1", Date.parse("2026-09-01T00:00:00.000Z"));
    expect(claimed).toBe(true);

    const put = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(put?.TableName).toBe("test-social-table");
    expect(put?.ConditionExpression).toBe("attribute_not_exists(pk)");
    expect(put?.Item).toMatchObject({
      pk: matchMastodonSharePk("match-1"),
      sk: MATCH_MASTODON_SHARE_SK,
      status: "pending",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    expect(typeof put?.Item?.ttl).toBe("number");
    expect(put?.Item?.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("does not overwrite when a second claim races", async () => {
    ddbMock.on(PutCommand).rejects({ name: "ConditionalCheckFailedException" });
    const repo = new MatchMastodonShareRepository(ddbMock as never, "test-social-table");

    const claimed = await repo.claim("match-1");
    expect(claimed).toBe(false);
  });

  it("reads a pending claim and marks it posted", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: matchMastodonSharePk("match-1"),
        sk: MATCH_MASTODON_SHARE_SK,
        status: "pending",
        createdAt: "2026-09-01T00:00:00.000Z",
        ttl: 1_000_000,
      },
    });
    ddbMock.on(UpdateCommand).resolves({});

    const repo = new MatchMastodonShareRepository(ddbMock as never, "test-social-table");
    const item = await repo.get("match-1");
    expect(item?.status).toBe("pending");

    await repo.markPosted("match-1", "status-99", Date.parse("2026-09-01T01:00:00.000Z"));
    const update = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(update?.ExpressionAttributeValues).toMatchObject({
      ":posted": "posted",
      ":id": "status-99",
      ":postedAt": "2026-09-01T01:00:00.000Z",
    });
  });
});
