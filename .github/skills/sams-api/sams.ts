#!/usr/bin/env tsx
/**
 * SAMS REST API testing/exploration tool.
 *
 * Usage: vp exec tsx --env-file=.env.local .github/skills/sams-api/sams.ts <resource> [uuid] [subresource] [--query key=value ...]
 *
 * Requires SAMS_API_KEY in .env.local.
 */

const BASE_URL = "https://www.volleyball-baden.de/api/v2";

function printHelp(): void {
	const script = "sams.ts";
	console.log(`Usage: vp exec tsx --env-file=.env.local .github/skills/sams-api/${script} <resource> [uuid] [subresource] [--query key=value ...]\n`);
	console.log("Requires SAMS_API_KEY in .env.local");
	console.log("Swagger: https://www.volleyball-baden.de/api/v2/swagger.json\n");
	console.log("Examples:");
	console.log(`  ${script} seasons --query size=1              # verify API key`);
	console.log(`  ${script} seasons                             # list all seasons`);
	console.log(`  ${script} leagues <uuid> rankings             # rankings for a league`);
	console.log(`  ${script} leagues <uuid> teams                # teams in a league`);
	console.log(`  ${script} league-matches --query leagueUuid=<uuid>`);
	console.log("\nRate limits: max 5 req/s (200 ms between calls); daily quota per key.");
}

function parseArgs(args: string[]): { positionals: string[]; query: Record<string, string> } {
	const positionals: string[] = [];
	const query: Record<string, string> = {};
	let i = 0;
	while (i < args.length) {
		const arg = args[i];
		if (arg === "--query" && i + 1 < args.length) {
			// --query key=value
			const raw = args[i + 1];
			const eqIdx = raw.indexOf("=");
			if (eqIdx !== -1) {
				query[raw.slice(0, eqIdx)] = raw.slice(eqIdx + 1);
			}
			i += 2;
		} else if (arg.startsWith("--query=")) {
			// --query=key=value
			const raw = arg.slice("--query=".length);
			const eqIdx = raw.indexOf("=");
			if (eqIdx !== -1) {
				query[raw.slice(0, eqIdx)] = raw.slice(eqIdx + 1);
			}
			i++;
		} else {
			positionals.push(arg);
			i++;
		}
	}
	return { positionals, query };
}

function buildPath(positionals: string[]): string {
	const resource = positionals[0];
	if (!resource) return "/";
	const uuid = positionals[1];
	const subresource = positionals[2];
	let path = `/${resource}`;
	if (uuid) path += `/${uuid}`;
	if (subresource) path += `/${subresource}`;
	return path;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
		printHelp();
		return;
	}

	const apiKey = process.env.SAMS_API_KEY;
	if (!apiKey) {
		console.error("Error: SAMS_API_KEY is not set. Add it to .env.local.");
		process.exit(1);
	}

	const { positionals, query } = parseArgs(args);
	const path = buildPath(positionals);
	const url = new URL(`${BASE_URL}${path}`);

	for (const [key, value] of Object.entries(query)) {
		url.searchParams.set(key, value);
	}

	console.error(`→ GET ${url.toString()}`);

	const response = await fetch(url.toString(), {
		headers: {
			"X-Api-Key": apiKey,
			Accept: "*/*",
		},
	});

	const text = await response.text();
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = text;
	}

	if (!response.ok) {
		console.error(`✗ HTTP ${response.status} ${response.statusText}`);
		console.error(typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
		process.exit(1);
	}

	console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err: unknown) => {
	console.error("Unexpected error:", err instanceof Error ? err.message : err);
	process.exit(1);
});
