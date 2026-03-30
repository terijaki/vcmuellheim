/**
 * DynamoDB-backed cache helpers for SAMS data.
 *
 * Survives Lambda cold starts — unlike in-memory caches, these persist across all
 * Lambda instances and visitor sessions.
 *
 * Key scheme (single content table, single-table design):
 *   PK: `sams_cache#<cacheKey>`
 *   SK: `sams_cache`
 *
 * Entry shape: `{ data: JSON-serialized payload, cachedAt: ISO timestamp string }`
 *
 * TTL is enforced at read time in application code, not via a DynamoDB TTL attribute.
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getContentTableName } from "@/lib/db/env";

const SAMS_CACHE_SK = "sams_cache";

/** 3 months — DynamoDB hygiene TTL to reclaim storage for orphaned cache keys */
const DDB_TTL_SECONDS = 90 * 24 * 60 * 60;

function buildPk(cacheKey: string): string {
	return `sams_cache#${cacheKey}`;
}

type SamsCacheEntry = {
	pk: string;
	sk: string;
	data: string;
	cachedAt: string;
	/** Unix epoch seconds — used by DynamoDB TTL to eventually delete the item */
	ttl: number;
};

/**
 * Read a SAMS cache entry from DynamoDB.
 *
 * Returns the deserialized value if a fresh entry exists (within TTL), otherwise `null`.
 */
export async function readSamsCacheEntry<T>(cacheKey: string, ttlMs: number, now: () => number = Date.now): Promise<T | null> {
	const result = await docClient.send(
		new GetCommand({
			TableName: getContentTableName(),
			Key: { pk: buildPk(cacheKey), sk: SAMS_CACHE_SK },
		}),
	);

	if (!result.Item) return null;

	const entry = result.Item as SamsCacheEntry;
	const cachedAtMs = new Date(entry.cachedAt).getTime();

	if (Number.isNaN(cachedAtMs) || now() - cachedAtMs > ttlMs) return null;

	return JSON.parse(entry.data) as T;
}

/**
 * Write a SAMS cache entry to DynamoDB.
 *
 * Serializes the value to JSON and records the current time as `cachedAt`.
 */
export async function writeSamsCacheEntry<T>(cacheKey: string, value: T, now: () => number = Date.now): Promise<void> {
	const nowMs = now();
	const entry: SamsCacheEntry = {
		pk: buildPk(cacheKey),
		sk: SAMS_CACHE_SK,
		data: JSON.stringify(value),
		cachedAt: new Date(nowMs).toISOString(),
		ttl: Math.floor(nowMs / 1000) + DDB_TTL_SECONDS,
	};

	await docClient.send(
		new PutCommand({
			TableName: getContentTableName(),
			Item: entry,
		}),
	);
}
