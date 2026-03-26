import { describe, expect, it } from "vite-plus/test";
import { buildLiveMatchesFromRaw, resolveClubLogoUrl } from "./sams";

describe("resolveClubLogoUrl", () => {
	const CF = "https://cdn.example.com";

	it("returns CloudFront URL when logoS3Key and cloudfrontUrl are set", () => {
		const result = resolveClubLogoUrl({ logoS3Key: "sams-logos/abc.png" }, CF);
		expect(result).toBe("https://cdn.example.com/sams-logos/abc.png");
	});

	it("falls back to logoImageLink when logoS3Key is absent", () => {
		const result = resolveClubLogoUrl({ logoImageLink: "https://sams.cdn/logo.png" }, CF);
		expect(result).toBe("https://sams.cdn/logo.png");
	});

	it("falls back to logoImageLink when cloudfrontUrl is empty", () => {
		const result = resolveClubLogoUrl({ logoS3Key: "sams-logos/abc.png", logoImageLink: "https://sams.cdn/logo.png" }, "");
		expect(result).toBe("https://sams.cdn/logo.png");
	});

	it("returns null when club has neither logo field", () => {
		const result = resolveClubLogoUrl({}, CF);
		expect(result).toBeNull();
	});

	it("returns null when club is null", () => {
		const result = resolveClubLogoUrl(null, CF);
		expect(result).toBeNull();
	});
});

// Minimal raw ticker shape (post-parse defaults applied)
const makeRaw = (
	overrides: {
		matchDays?: { date?: string; matches: { id: string; date?: string | number; team1: string; team2: string; teamDescription1?: string; teamDescription2?: string }[] }[];
		matchStates?: Record<string, { started: boolean; finished: boolean; setPoints?: { team1: number; team2: number }; matchSets: { setNumber: number; setScore: { team1: number; team2: number } }[] }>;
	} = {},
) => ({
	matchDays: overrides.matchDays ?? [],
	matchStates: overrides.matchStates ?? {},
});

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const todayIso = today.toISOString();
const yesterdayIso = yesterday.toISOString();

describe("buildLiveMatchesFromRaw", () => {
	it("returns empty array when there are no matchStates", () => {
		const result = buildLiveMatchesFromRaw(makeRaw());
		expect(result).toHaveLength(0);
	});

	it("filters out matches that are not started", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: false, finished: false, matchSets: [] } },
			}),
		);
		expect(result).toHaveLength(0);
	});

	it("filters out started matches with no team metadata", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchStates: { "unknown-match": { started: true, finished: false, matchSets: [] } },
			}),
		);
		expect(result).toHaveLength(0);
	});

	it("includes started matches that have team metadata", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: true, finished: false, matchSets: [] } },
			}),
		);
		expect(result).toHaveLength(1);
		expect(result[0]?.matchUuid).toBe("m1");
	});

	it("defaults setPoints to 0:0 when absent", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: true, finished: false, matchSets: [] } },
			}),
		);
		expect(result[0]?.state.setPoints).toEqual({ team1: 0, team2: 0 });
	});

	it("uses setPoints from state when present", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: true, finished: false, setPoints: { team1: 2, team2: 1 }, matchSets: [] } },
			}),
		);
		expect(result[0]?.state.setPoints).toEqual({ team1: 2, team2: 1 });
	});

	it("uses teamDescription1/2 as names when provided", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "uuid-1", team2: "uuid-2", teamDescription1: "VC Müllheim", teamDescription2: "Other Club" }] }],
				matchStates: { m1: { started: true, finished: false, matchSets: [] } },
			}),
		);
		expect(result[0]?.team1Name).toBe("VC Müllheim");
		expect(result[0]?.team2Name).toBe("Other Club");
	});

	it("falls back to team UUID as name when teamDescription is absent", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "uuid-1", team2: "uuid-2" }] }],
				matchStates: { m1: { started: true, finished: false, matchSets: [] } },
			}),
		);
		expect(result[0]?.team1Name).toBe("uuid-1");
		expect(result[0]?.team2Name).toBe("uuid-2");
	});

	it("maps finished state correctly", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: true, finished: true, setPoints: { team1: 3, team2: 1 }, matchSets: [] } },
			}),
		);
		expect(result[0]?.state.finished).toBe(true);
	});

	it("filters out started matches from previous days", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ matches: [{ id: "m1", date: yesterdayIso, team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: true, finished: true, matchSets: [] } },
			}),
		);
		expect(result).toHaveLength(0);
	});

	it("uses matchDay date fallback when match date is missing", () => {
		const result = buildLiveMatchesFromRaw(
			makeRaw({
				matchDays: [{ date: todayIso, matches: [{ id: "m1", team1: "t1", team2: "t2" }] }],
				matchStates: { m1: { started: true, finished: false, matchSets: [] } },
			}),
		);
		expect(result).toHaveLength(1);
	});
});
