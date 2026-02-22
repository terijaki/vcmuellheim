#!/usr/bin/env bun
/**
 * Creates a GitHub issue summarising the SAMS health check results.
 * Invoked by .github/workflows/sams-health-check.yml (notify job).
 *
 * Reads context from environment variables injected by the workflow.
 * Uses GITHUB_TOKEN for authentication via the GitHub REST API.
 * Uses GITHUB_REPOSITORY and GITHUB_RUN_ID which Actions injects automatically.
 *
 * Bug descriptions must stay in sync with scripts/check-sams-bugs.ts.
 */

export {};

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY; // "owner/repo"
const runId = process.env.GITHUB_RUN_ID;

if (!token || !repository || !runId) {
	console.error("Missing required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID");
	process.exit(1);
}

const [owner, repo] = repository.split("/");
const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
const date = new Date().toISOString().split("T")[0];

const hasDrift = process.env.HAS_DRIFT === "true";
const hasFixed = process.env.HAS_FIXED === "true";
const fixedBugIds = (process.env.FIXED_BUG_IDS ?? "").split(",").filter(Boolean).map(Number);
const checkFailedIds = (process.env.CHECK_FAILED_IDS ?? "").split(",").filter(Boolean).map(Number);
const regenFailed = process.env.REGEN_FAILED === "true";
const failureStep = process.env.FAILURE_STEP ?? "";
const swaggerJobFailed = process.env.SWAGGER_DRIFT_RESULT === "failure";
const bugCheckJobFailed = process.env.BUG_CHECK_RESULT === "failure";
const regenJobFailed = process.env.REGENERATE_RESULT === "failure";

const bugDescriptions: Record<number, string> = {
	1: "SBVV missing from `GET /associations` paginated list",
	2: "`logoImageForScreenOutputLink` always `null` on `GET /teams/{uuid}`",
	3: "`scoreIncludingLosses` always `null` in `GET /leagues/{uuid}/rankings`",
	4: "`Accept: application/json` returns HTTP 406 instead of 200",
	5: '`shortName`/`clubCode` return `""` instead of `null` on `GET /teams/{uuid}`',
	6: "`date` field declared as `date-time` but API returns a date-only string (`YYYY-MM-DD`)",
};

const allBugIds = [1, 2, 3, 4, 5, 6];
const fixedSet = new Set(fixedBugIds);
const failedSet = new Set(checkFailedIds);
const rows = allBugIds.map((id) => {
	const status = fixedSet.has(id) ? "✅ Fixed" : failedSet.has(id) ? "❌ Check failed" : "⚠️ Still present";
	return `| ${id} | ${bugDescriptions[id]} | ${status} |`;
});
const bugTable = ["| # | Bug | Status |", "|---|---|---|", ...rows].join("\n");

const labels = ["sams", "needs-review"];
const sections: string[] = [];
const titleParts: string[] = [];

if (hasDrift) {
	labels.push("drift-detection");
	titleParts.push("⚠️ swagger drift");
	sections.push(`## ⚠️ Swagger Drift Detected

The upstream spec at \`https://www.volleyball-baden.de/api/v2/swagger.json\` has changed since the last committed snapshot in \`codegen/sams/generated/source.json\`.

Run \`bun run sams:update\` locally, review \`codegen/sams/generated/source.json\` for what changed, and commit the updated generated files once verified.

[Full diff in workflow run](${runUrl})`);
}

if (hasFixed) {
	labels.push("bug-fixed");
	titleParts.push("✅ bugs fixed");
	sections.push(`## ✅ Upstream Bug(s) Fixed

Bug(s) **${fixedBugIds.join(", ")}** are no longer reproducible against the live API. Review the relevant \`parser.patch.schemas\` entries in \`codegen/sams/generate-client.ts\` and remove any workarounds that compensate for the now-fixed behaviour.

${bugTable}`);
} else {
	sections.push(`## Bug Check Results\n\n${bugTable}`);
}

if (regenFailed || regenJobFailed) {
	titleParts.push("❌ regen failed");
	sections.push(`## ❌ Regeneration / Verification Failed

The \`${failureStep || "regenerate"}\` step failed after pulling the latest spec. The generated client or test suite may be out of sync with the current upstream API.

[View step output](${runUrl})`);
}

if (swaggerJobFailed) {
	titleParts.push("❌ drift check failed");
	sections.push(`## ❌ Swagger Drift Check Job Failed\n\nThe job itself failed (likely a network or tooling error).\n\n[View run](${runUrl})`);
}

if (bugCheckJobFailed) {
	titleParts.push("❌ bug check failed");
	sections.push(`## ❌ Bug Check Job Failed\n\nThe job itself failed. Confirm that \`SAMS_API_KEY\` is set as a repository secret.\n\n[View run](${runUrl})`);
}

const titleSuffix = titleParts.length > 0 ? titleParts.join(" · ") : "action required";

const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
	method: "POST",
	headers: {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"Content-Type": "application/json",
		"X-GitHub-Api-Version": "2022-11-28",
	},
	body: JSON.stringify({
		title: `[SAMS] ${titleSuffix} — ${date}`,
		body: `${sections.join("\n\n---\n\n")}\n\n---\n\n_Weekly health check · [View run](${runUrl})_`,
		labels,
	}),
});

if (!response.ok) {
	const text = await response.text();
	console.error(`Failed to create issue: HTTP ${response.status}\n${text}`);
	process.exit(1);
}

const issue = (await response.json()) as { html_url: string; number: number };
console.log(`Created issue #${issue.number}: ${issue.html_url}`);
