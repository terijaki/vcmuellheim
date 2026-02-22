#!/usr/bin/env bun
/**
 * Checks the 5 known upstream SAMS API bugs against the live API.
 *
 * Outputs JSON: { bugs: BugResult[], checkedAt: string }
 * Exits 0 always — a "fixed" bug is good news, not a failure.
 * Exits 1 only when SAMS_API_KEY is missing or an unexpected error occurs.
 *
 * Used by the sams-health-check GitHub Actions workflow.
 * Bug reference: .github/skills/sams-api/BUGS.md
 */

const BASE_URL = "https://www.volleyball-baden.de/api/v2";

// Known UUIDs (season 2025/26) — see .github/skills/sams-api/API-OVERVIEW.md
const SBVV_UUID = "2b7571b5-f985-c552-ea1c-f819ed3811c1";
const VERBANDSLIGA_HERREN_UUID = "2000b48f-eec8-4927-beb1-c4568069ebec";
// VC Müllheim 1 (Herren) — used for team-level bug checks
const VC_MULLHEIM_TEAM_UUID = "c2ddea7c-b7ec-4172-aa85-4d9c47aba362";

type BugStatus = "still_present" | "fixed" | "check_failed";

interface BugResult {
	id: number;
	summary: string;
	status: BugStatus;
	detail?: string;
}

interface CheckResult {
	bugs: BugResult[];
	checkedAt: string;
}

async function samsGet(path: string, apiKey: string, overrideHeaders?: HeadersInit): Promise<Response> {
	const url = `${BASE_URL}${path}`;
	return fetch(url, {
		headers: {
			Accept: "*/*",
			"X-Api-Key": apiKey,
			...overrideHeaders,
		},
	});
}

// Bug #1 — SBVV absent from GET /associations paginated list
// The association exists at its direct UUID but never appears in the full list.
async function checkBug1(apiKey: string): Promise<BugResult> {
	const id = 1;
	const summary = "SBVV missing from GET /associations paginated list";
	try {
		let page = 0;
		let found = false;
		let isLast = false;
		while (!isLast) {
			const res = await samsGet(`/associations?size=100&page=${page}`, apiKey);
			if (!res.ok) {
				return { id, summary, status: "check_failed", detail: `HTTP ${res.status}` };
			}
			const data = (await res.json()) as { content?: Array<{ uuid: string }>; last?: boolean };
			if (data.content?.some((a) => a.uuid === SBVV_UUID)) {
				found = true;
				break;
			}
			isLast = data.last ?? true;
			page++;
		}
		return { id, summary, status: found ? "fixed" : "still_present" };
	} catch (e) {
		return { id, summary, status: "check_failed", detail: String(e) };
	}
}

// Bug #2 — logoImageForScreenOutputLink always null on GET /teams/{uuid}
// Spec defines it as a non-nullable URL string; API always returns null.
async function checkBug2(apiKey: string): Promise<BugResult> {
	const id = 2;
	const summary = "logoImageForScreenOutputLink always null on GET /teams/{uuid}";
	try {
		const res = await samsGet(`/teams/${VC_MULLHEIM_TEAM_UUID}`, apiKey);
		if (!res.ok) {
			return { id, summary, status: "check_failed", detail: `HTTP ${res.status}` };
		}
		const data = (await res.json()) as { logoImageForScreenOutputLink?: string | null };
		const isFixed = data.logoImageForScreenOutputLink !== null && data.logoImageForScreenOutputLink !== undefined;
		return { id, summary, status: isFixed ? "fixed" : "still_present" };
	} catch (e) {
		return { id, summary, status: "check_failed", detail: String(e) };
	}
}

// Bug #3 — scoreIncludingLosses always null in GET /leagues/{uuid}/rankings
// All other stat fields populate correctly; only this one is always null.
async function checkBug3(apiKey: string): Promise<BugResult> {
	const id = 3;
	const summary = "scoreIncludingLosses always null in GET /leagues/{uuid}/rankings";
	try {
		const res = await samsGet(`/leagues/${VERBANDSLIGA_HERREN_UUID}/rankings`, apiKey);
		if (!res.ok) {
			return { id, summary, status: "check_failed", detail: `HTTP ${res.status}` };
		}
		const data = (await res.json()) as { content?: Array<{ scoreIncludingLosses: unknown }> } | Array<{ scoreIncludingLosses: unknown }>;
		const entries = Array.isArray(data) ? data : (data.content ?? []);
		const isFixed = entries.some((e) => e.scoreIncludingLosses !== null && e.scoreIncludingLosses !== undefined);
		return { id, summary, status: isFixed ? "fixed" : "still_present" };
	} catch (e) {
		return { id, summary, status: "check_failed", detail: String(e) };
	}
}

// Bug #4 — Accept: application/json returns HTTP 406
// Spec only declares application/hal+json; this is spec-compliant but diverges from REST norms.
// No API key needed for this check.
async function checkBug4(): Promise<BugResult> {
	const id = 4;
	const summary = "Accept: application/json returns HTTP 406 instead of 200";
	try {
		const res = await fetch(`${BASE_URL}/seasons`, {
			headers: { Accept: "application/json" },
		});
		return {
			id,
			summary,
			status: res.status === 200 ? "fixed" : "still_present",
			detail: res.status === 200 ? undefined : `Status: ${res.status}`,
		};
	} catch (e) {
		return { id, summary, status: "check_failed", detail: String(e) };
	}
}

// Bug #5 — shortName/clubCode return "" instead of null on GET /teams/{uuid}
// Unset optional fields should be null; API returns empty string instead.
// Heuristic: checks VC Müllheim 1 whose shortName/clubCode are not explicitly set.
async function checkBug5(apiKey: string): Promise<BugResult> {
	const id = 5;
	const summary = 'shortName/clubCode return "" instead of null on GET /teams/{uuid}';
	try {
		const res = await samsGet(`/teams/${VC_MULLHEIM_TEAM_UUID}`, apiKey);
		if (!res.ok) {
			return { id, summary, status: "check_failed", detail: `HTTP ${res.status}` };
		}
		const data = (await res.json()) as { shortName?: string | null; clubCode?: string | null };
		const bugPresent = data.shortName === "" || data.clubCode === "";
		return { id, summary, status: bugPresent ? "still_present" : "fixed" };
	} catch (e) {
		return { id, summary, status: "check_failed", detail: String(e) };
	}
}

async function main(): Promise<void> {
	const apiKey = process.env.SAMS_API_KEY;
	if (!apiKey) {
		console.error("Error: SAMS_API_KEY is not set.");
		process.exit(1);
	}

	const [bug1, bug2, bug3, bug4, bug5] = await Promise.all([checkBug1(apiKey), checkBug2(apiKey), checkBug3(apiKey), checkBug4(), checkBug5(apiKey)]);

	const result: CheckResult = {
		bugs: [bug1, bug2, bug3, bug4, bug5],
		checkedAt: new Date().toISOString(),
	};

	console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
	console.error("Unexpected error:", err instanceof Error ? err.message : err);
	process.exit(1);
});
