import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

let readSamsCacheEntry: typeof import("./sams-ddb-cache").readSamsCacheEntry;
let writeSamsCacheEntry: typeof import("./sams-ddb-cache").writeSamsCacheEntry;

beforeAll(async () => {
	process.env.CONTENT_TABLE_NAME = "test-content-table";
	const module = await import("./sams-ddb-cache");
	readSamsCacheEntry = module.readSamsCacheEntry;
	writeSamsCacheEntry = module.writeSamsCacheEntry;
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

describe("readSamsCacheEntry", () => {
	it("returns null on a cache miss (item not in DDB)", async () => {
		ddbMock.on(GetCommand).resolves({ Item: undefined });

		const result = await readSamsCacheEntry<TestPayload>("league-abc", TTL_MS);

		expect(result).toBeNull();
	});

	it("returns null when cachedAt is older than the TTL", async () => {
		const staleTime = new Date(Date.now() - TTL_MS - 1000).toISOString();
		ddbMock.on(GetCommand).resolves({
			Item: {
				pk: "sams_cache#league-abc",
				sk: "sams_cache",
				data: JSON.stringify(SAMPLE_PAYLOAD),
				cachedAt: staleTime,
			},
		});

		const result = await readSamsCacheEntry<TestPayload>("league-abc", TTL_MS);

		expect(result).toBeNull();
	});

	it("returns the deserialized value when the entry is fresh", async () => {
		const freshTime = new Date(Date.now() - 1000).toISOString(); // 1 second ago
		ddbMock.on(GetCommand).resolves({
			Item: {
				pk: "sams_cache#league-abc",
				sk: "sams_cache",
				data: JSON.stringify(SAMPLE_PAYLOAD),
				cachedAt: freshTime,
			},
		});

		const result = await readSamsCacheEntry<TestPayload>("league-abc", TTL_MS);

		expect(result).toEqual(SAMPLE_PAYLOAD);
	});

	it("returns the deserialized value when cachedAt is exactly at the TTL boundary (still fresh)", async () => {
		const fixedNow = 1_000_000;
		const staleTime = new Date(fixedNow - TTL_MS).toISOString();
		ddbMock.on(GetCommand).resolves({
			Item: {
				pk: "sams_cache#league-abc",
				sk: "sams_cache",
				data: JSON.stringify(SAMPLE_PAYLOAD),
				cachedAt: staleTime,
			},
		});

		const result = await readSamsCacheEntry<TestPayload>("league-abc", TTL_MS, () => fixedNow);

		// age === TTL_MS, which is NOT > TTL_MS so it's still fresh
		expect(result).toEqual(SAMPLE_PAYLOAD);
	});
});

describe("writeSamsCacheEntry", () => {
	it("puts an item into DynamoDB with the correct key scheme and a 3-month DynamoDB TTL", async () => {
		ddbMock.on(PutCommand).resolves({});

		const fixedNow = new Date("2026-01-01T12:00:00.000Z").getTime();
		await writeSamsCacheEntry("league-xyz", SAMPLE_PAYLOAD, () => fixedNow);

		const putCalls = ddbMock.commandCalls(PutCommand);
		expect(putCalls).toHaveLength(1);

		const item = putCalls[0].args[0].input.Item as Record<string, unknown>;
		expect(item.pk).toBe("sams_cache#league-xyz");
		expect(item.sk).toBe("sams_cache");
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

		await writeSamsCacheEntry("round-trip-key", SAMPLE_PAYLOAD, () => fixedNow);

		// Extract what was written and feed it back for the read
		const putCalls = ddbMock.commandCalls(PutCommand);
		expect(putCalls).toHaveLength(1);
		const writtenItem = putCalls[0].args[0].input.Item as Record<string, unknown>;

		ddbMock.on(GetCommand).resolves({ Item: writtenItem });

		const result = await readSamsCacheEntry<TestPayload>("round-trip-key", TTL_MS, () => fixedNow + 1000);

		expect(result).toEqual(SAMPLE_PAYLOAD);
		expect(writtenItem.cachedAt).toBe(expectedCachedAt);
	});
});
