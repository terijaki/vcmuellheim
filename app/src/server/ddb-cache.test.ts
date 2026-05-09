import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

let readCacheEntry: typeof import("./ddb-cache").readCacheEntry;
let writeCacheEntry: typeof import("./ddb-cache").writeCacheEntry;

beforeAll(async () => {
  process.env.CACHE_TABLE_NAME = "test-cache-table";
  const module = await import("./ddb-cache");
  readCacheEntry = module.readCacheEntry;
  writeCacheEntry = module.writeCacheEntry;
});

beforeEach(() => {
  ddbMock.reset();
});

const TTL_MS = 5 * 60 * 1000; // 5 minutes

type TestPayload = { leagueId: string; rankings: string[] };

const SAMPLE_PAYLOAD: TestPayload = {
  leagueId: "league-abc",
  rankings: ["Team A", "Team B"],
};

describe("readCacheEntry", () => {
  it("returns null on a cache miss (item not in DDB)", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await readCacheEntry<TestPayload>("league-abc", TTL_MS);

    expect(result).toBeNull();
  });

  it("returns null when cachedAt is older than the TTL", async () => {
    const staleTime = new Date(Date.now() - TTL_MS - 1000).toISOString();
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "cache#league-abc",
        sk: "cache",
        data: JSON.stringify(SAMPLE_PAYLOAD),
        cachedAt: staleTime,
      },
    });

    const result = await readCacheEntry<TestPayload>("league-abc", TTL_MS);

    expect(result).toBeNull();
  });

  it("returns the deserialized value when the entry is fresh", async () => {
    const freshTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "cache#league-abc",
        sk: "cache",
        data: JSON.stringify(SAMPLE_PAYLOAD),
        cachedAt: freshTime,
      },
    });

    const result = await readCacheEntry<TestPayload>("league-abc", TTL_MS);

    expect(result).toEqual(SAMPLE_PAYLOAD);
  });

  it("returns the deserialized value when cachedAt is exactly at the TTL boundary (still fresh)", async () => {
    const fixedNow = 1_000_000;
    const staleTime = new Date(fixedNow - TTL_MS).toISOString();
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "cache#league-abc",
        sk: "cache",
        data: JSON.stringify(SAMPLE_PAYLOAD),
        cachedAt: staleTime,
      },
    });

    const result = await readCacheEntry<TestPayload>("league-abc", TTL_MS, () => fixedNow);

    // age === TTL_MS, which is NOT > TTL_MS so it's still fresh
    expect(result).toEqual(SAMPLE_PAYLOAD);
  });
});

describe("writeCacheEntry", () => {
  it("puts an item into DynamoDB with the correct key scheme and a 3-month DynamoDB TTL", async () => {
    ddbMock.on(PutCommand).resolves({});

    const fixedNow = new Date("2026-01-01T12:00:00.000Z").getTime();
    await writeCacheEntry("league-xyz", SAMPLE_PAYLOAD, () => fixedNow);

    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);

    const item = putCalls[0].args[0].input.Item as Record<string, unknown>;
    expect(item.pk).toBe("cache#league-xyz");
    expect(item.sk).toBe("cache");
    expect(item.cachedAt).toBe("2026-01-01T12:00:00.000Z");
    expect(JSON.parse(item.data as string)).toEqual(SAMPLE_PAYLOAD);

    // DynamoDB TTL should be ~3 months (90 days) after fixedNow
    const expectedTtl = Math.floor(fixedNow / 1000) + 90 * 24 * 60 * 60;
    expect(item.ttl).toBe(expectedTtl);
  });
});

describe("round-trip: write then read", () => {
  it("written entry is returned as fresh by read", async () => {
    const fixedNow = new Date("2026-03-30T10:00:00.000Z").getTime();
    const expectedCachedAt = new Date(fixedNow).toISOString();

    ddbMock.on(PutCommand).resolves({});

    await writeCacheEntry("round-trip-key", SAMPLE_PAYLOAD, () => fixedNow);

    // Extract what was written and feed it back for the read
    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    const writtenItem = putCalls[0].args[0].input.Item as Record<string, unknown>;

    ddbMock.on(GetCommand).resolves({ Item: writtenItem });

    const result = await readCacheEntry<TestPayload>(
      "round-trip-key",
      TTL_MS,
      () => fixedNow + 1000,
    );

    expect(result).toEqual(SAMPLE_PAYLOAD);
    expect(writtenItem.cachedAt).toBe(expectedCachedAt);
  });
});

describe("Infinity TTL (loader peek contract)", () => {
  // Route loaders use Infinity as the TTL so they always return whatever is cached,
  // regardless of age. This prevents the loader from blocking navigation while waiting
  // for a stale refresh. React Query handles freshness client-side after render.
  it("returns data that is far beyond a normal TTL when Infinity is passed", async () => {
    // Data cached 1 year ago
    const oneYearAgoMs = Date.now() - 365 * 24 * 60 * 60 * 1000;
    ddbMock.on(GetCommand).resolves({
      Item: {
        pk: "cache#old-key",
        sk: "cache",
        data: JSON.stringify(SAMPLE_PAYLOAD),
        cachedAt: new Date(oneYearAgoMs).toISOString(),
      },
    });

    const result = await readCacheEntry<TestPayload>("old-key", Infinity);

    expect(result).toEqual(SAMPLE_PAYLOAD);
  });

  it("still returns null on a cache miss even with Infinity TTL", async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const result = await readCacheEntry<TestPayload>("no-entry", Infinity);

    expect(result).toBeNull();
  });
});
