import { describe, expect, it } from "bun:test";
import { buildLeagueOrderingContext, calculateLastResultCap, sortLeagueUuidsByLevels } from "./ranking";

describe("buildLeagueOrderingContext", () => {
	it("collects unique league UUIDs in first-seen order", () => {
		const teams = [
			{ leagueUuid: "league-b", leagueName: "League B" },
			{ leagueUuid: "league-a", leagueName: "League A" },
			{ leagueUuid: "league-b", leagueName: "League B" },
			{ leagueUuid: null, leagueName: "No League" },
		];

		const result = buildLeagueOrderingContext(teams);

		expect(result.leagueUuids).toEqual(["league-b", "league-a"]);
	});

	it("reads season and association UUID from available teams", () => {
		const teams = [
			{ leagueUuid: "league-a", seasonUuid: null, associationUuid: null },
			{ leagueUuid: "league-b", seasonUuid: "season-1", associationUuid: "association-1" },
		];

		const result = buildLeagueOrderingContext(teams);

		expect(result.seasonUuid).toBe("season-1");
		expect(result.associationUuid).toBe("association-1");
	});
});

describe("sortLeagueUuidsByLevels", () => {
	it("sorts by league level ascending when levels are available", () => {
		const leagueUuids = ["league-c", "league-a", "league-b"];

		const result = sortLeagueUuidsByLevels({
			leagueUuids,
			leagueLevels: { "league-a": 1, "league-b": 2, "league-c": 3 },
			leagueNameByUuid: new Map([
				["league-a", "A"],
				["league-b", "B"],
				["league-c", "C"],
			]),
			leagueOrderByUuid: new Map([
				["league-c", 0],
				["league-a", 1],
				["league-b", 2],
			]),
		});

		expect(result).toEqual(["league-a", "league-b", "league-c"]);
	});

	it("falls back to league name when level is equal or missing", () => {
		const leagueUuids = ["league-z", "league-a"];

		const result = sortLeagueUuidsByLevels({
			leagueUuids,
			leagueLevels: { "league-z": null, "league-a": null },
			leagueNameByUuid: new Map([
				["league-z", "Zeta League"],
				["league-a", "Alpha League"],
			]),
			leagueOrderByUuid: new Map([
				["league-z", 0],
				["league-a", 1],
			]),
		});

		expect(result).toEqual(["league-a", "league-z"]);
	});

	it("falls back to original order when level and name are equal", () => {
		const leagueUuids = ["league-first", "league-second"];

		const result = sortLeagueUuidsByLevels({
			leagueUuids,
			leagueLevels: { "league-first": null, "league-second": null },
			leagueNameByUuid: new Map([
				["league-first", "Same Name"],
				["league-second", "Same Name"],
			]),
			leagueOrderByUuid: new Map([
				["league-first", 0],
				["league-second", 1],
			]),
		});

		expect(result).toEqual(["league-first", "league-second"]);
	});
});

describe("calculateLastResultCap", () => {
	it("uses minimum cap of 6", () => {
		expect(calculateLastResultCap(1, 2.3)).toBe(6);
	});

	it("calculates capped value in the middle range", () => {
		expect(calculateLastResultCap(4, 2.3)).toBe(9);
	});

	it("uses maximum cap of 20", () => {
		expect(calculateLastResultCap(30, 2.3)).toBe(20);
	});
});
