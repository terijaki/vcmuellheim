import { describe, expect, it, vi } from "vite-plus/test";
import { createCacheKey, createExpiringCache, getOrSetExpiringCacheValue } from "./cache";

describe("createCacheKey", () => {
	it("creates the same key regardless of object key order", () => {
		expect(
			createCacheKey({
				seasonUuid: "season-1",
				associationUuid: "assoc-1",
				leagueUuids: ["league-b", "league-a"],
			}),
		).toBe(
			createCacheKey({
				leagueUuids: ["league-a", "league-b"],
				associationUuid: "assoc-1",
				seasonUuid: "season-1",
			}),
		);
	});

	it("normalizes array order and removes duplicates", () => {
		expect(
			createCacheKey({
				leagueUuids: ["league-c", "league-a", "league-c", "league-b"],
			}),
		).toBe(
			createCacheKey({
				leagueUuids: ["league-b", "league-a", "league-c"],
			}),
		);
	});

	it("normalizes nullish values consistently", () => {
		expect(
			createCacheKey({
				associationUuid: undefined,
				seasonUuid: null,
				leagueUuids: [],
			}),
		).toBe(
			JSON.stringify({
				associationUuid: "",
				leagueUuids: [],
				seasonUuid: "",
			}),
		);
	});

	it("supports primitive cache key parts", () => {
		expect(
			createCacheKey({
				enabled: true,
				page: 2,
				query: "clubs",
			}),
		).toBe(
			JSON.stringify({
				enabled: true,
				page: 2,
				query: "clubs",
			}),
		);
	});
});

describe("getOrSetExpiringCacheValue", () => {
	it("returns cached values before expiry", async () => {
		const cache = createExpiringCache<string>();
		const load = vi.fn(async () => "fresh-value");
		const now = () => 1_000;

		const first = await getOrSetExpiringCacheValue({
			cache,
			keyParts: { leagueUuids: ["league-a"] },
			ttlMs: 500,
			load,
			now,
		});

		const second = await getOrSetExpiringCacheValue({
			cache,
			keyParts: { leagueUuids: ["league-a"] },
			ttlMs: 500,
			load,
			now: () => 1_200,
		});

		expect(first).toBe("fresh-value");
		expect(second).toBe("fresh-value");
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("reloads values after expiry", async () => {
		const cache = createExpiringCache<string>();
		const values = ["value-1", "value-2"];
		const load = vi.fn(async () => values.shift() ?? "unexpected-value");

		const first = await getOrSetExpiringCacheValue({
			cache,
			keyParts: { leagueUuids: ["league-a"] },
			ttlMs: 100,
			load,
			now: () => 1_000,
		});

		const second = await getOrSetExpiringCacheValue({
			cache,
			keyParts: { leagueUuids: ["league-a"] },
			ttlMs: 100,
			load,
			now: () => 1_101,
		});

		expect(first).toBe("value-1");
		expect(second).toBe("value-2");
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("creates isolated cache instances", () => {
		const first = createExpiringCache<string>();
		const second = createExpiringCache<string>();

		first.set("key", { value: "cached", expiresAt: 123 });

		expect(second.has("key")).toBe(false);
	});
});
