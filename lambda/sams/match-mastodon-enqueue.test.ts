import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import type { Match } from "sams-provider-events";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { enqueueNewlyConcludedMatchShares } from "./match-mastodon-enqueue";
import type { MatchForConclusion } from "./match-conclusion";

// aws-sdk-client-mock's Client generics lag newer @aws-sdk/client-sqs smithy types
const sqsMock = mockClient(SQSClient as never);

const CLUB_A = "club-a";
const OTHER = "other-club";
const CONFIGURED = new Set([CLUB_A]);
const QUEUE_URL = "https://sqs.eu-central-1.amazonaws.com/123/vcm-match-mastodon-prod";

describe("enqueueNewlyConcludedMatchShares", () => {
  beforeEach(() => {
    sqsMock.reset();
  });

  it("sends SendMessageCommand via SQS for newly concluded matches in prod", async () => {
    sqsMock.on(SendMessageCommand as never).resolves({});

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const previous: MatchForConclusion[] = [
      {
        uuid: "match-sqs-1",
        hasResult: false,
        team1: { sportsclubUuid: CLUB_A },
        team2: { sportsclubUuid: OTHER },
      },
    ];
    const incoming = [
      {
        uuid: "match-sqs-1",
        hasResult: true,
        team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: CLUB_A },
        team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: OTHER },
      },
    ] as Match[];

    await enqueueNewlyConcludedMatchShares(previous, incoming, CONFIGURED, {
      environment: "prod",
      queueUrl: QUEUE_URL,
      logger,
    });

    const calls = sqsMock.commandCalls(SendMessageCommand as never);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as {
      QueueUrl?: string;
      MessageBody?: string;
    };
    expect(input.QueueUrl).toBe(QUEUE_URL);
    const body = JSON.parse(String(input.MessageBody)) as {
      match: { uuid: string };
      configuredSportsclubUuids: string[];
    };
    expect(body.match.uuid).toBe("match-sqs-1");
    expect(body.configuredSportsclubUuids).toEqual([CLUB_A]);
  });

  it("does not call SQS outside prod", async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const incoming = [
      {
        uuid: "match-sqs-1",
        hasResult: true,
        team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: CLUB_A },
        team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: OTHER },
      },
    ] as Match[];

    await enqueueNewlyConcludedMatchShares([], incoming, CONFIGURED, {
      environment: "dev",
      queueUrl: QUEUE_URL,
      logger,
    });

    expect(sqsMock.commandCalls(SendMessageCommand as never)).toHaveLength(0);
  });
});
