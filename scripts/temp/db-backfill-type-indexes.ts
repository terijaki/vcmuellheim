#!/usr/bin/env bun

/**
 * Backfill migration for newly indexed content entities.
 *
 * Purpose:
 * - Populate missing `type` discriminator values on legacy rows
 * - Re-write items through ElectroDB so GSI1 byType keys are materialized
 *
 * Usage:
 *   bun run scripts/temp/db-backfill-type-indexes.ts
 *   bun run scripts/temp/db-backfill-type-indexes.ts --dry-run
 *   bun run scripts/temp/db-backfill-type-indexes.ts --members --sponsors
 *   bun run scripts/temp/db-backfill-type-indexes.ts --table vcm-content-dev
 */

import { docClient } from "@/lib/db/client";
import { createDb } from "@/lib/db/electrodb-client";
import { getContentTableName } from "@/lib/db/env";
import { busSchema, cmsUserSchema, locationSchema, memberSchema, sponsorSchema } from "@/lib/db/schemas";
import type { Bus, CmsUser, Location, Member, Sponsor } from "@/lib/db/types";

type Target = "members" | "sponsors" | "locations" | "bus" | "users";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function getArgValue(flag: string): string | undefined {
	const idx = args.indexOf(flag);
	return idx >= 0 ? args[idx + 1] : undefined;
}

const tableFromArg = getArgValue("--table");
if (tableFromArg) {
	process.env.CONTENT_TABLE_NAME = tableFromArg;
}

const tableName = getContentTableName();
const entities = createDb(docClient, tableName);

function selectedTargets(): Target[] {
	const possible: Target[] = ["members", "sponsors", "locations", "bus", "users"];
	const explicit = possible.filter((target) => args.includes(`--${target}`));
	return explicit.length > 0 ? explicit : possible;
}

async function backfillMembers(): Promise<void> {
	const result = await entities.member.scan.go({ pages: "all" });
	const items = result.data as Member[];

	let rewritten = 0;
	for (const item of items) {
		const next = memberSchema.parse({ ...item, type: "member" });
		if (!dryRun) {
			await entities.member.put(next).go();
		}
		rewritten++;
	}

	console.log(`[members] scanned=${items.length} rewritten=${rewritten}${dryRun ? " (dry-run)" : ""}`);
}

async function backfillSponsors(): Promise<void> {
	const result = await entities.sponsor.scan.go({ pages: "all" });
	const items = result.data as Sponsor[];

	let rewritten = 0;
	for (const item of items) {
		const next = sponsorSchema.parse({ ...item, type: "sponsor" });
		if (!dryRun) {
			await entities.sponsor.put(next).go();
		}
		rewritten++;
	}

	console.log(`[sponsors] scanned=${items.length} rewritten=${rewritten}${dryRun ? " (dry-run)" : ""}`);
}

async function backfillLocations(): Promise<void> {
	const result = await entities.location.scan.go({ pages: "all" });
	const items = result.data as Location[];

	let rewritten = 0;
	for (const item of items) {
		const next = locationSchema.parse({ ...item, type: "location" });
		if (!dryRun) {
			await entities.location.put(next).go();
		}
		rewritten++;
	}

	console.log(`[locations] scanned=${items.length} rewritten=${rewritten}${dryRun ? " (dry-run)" : ""}`);
}

async function backfillBus(): Promise<void> {
	const result = await entities.bus.scan.go({ pages: "all" });
	const items = result.data as Bus[];

	let rewritten = 0;
	for (const item of items) {
		const next = busSchema.parse({ ...item, type: "bus" });
		if (!dryRun) {
			await entities.bus.put(next).go();
		}
		rewritten++;
	}

	console.log(`[bus] scanned=${items.length} rewritten=${rewritten}${dryRun ? " (dry-run)" : ""}`);
}

async function backfillUsers(): Promise<void> {
	const result = await entities.user.scan.go({ pages: "all" });
	const items = result.data as CmsUser[];

	let rewritten = 0;
	for (const item of items) {
		const next = cmsUserSchema.parse({ ...item, type: "user" });
		if (!dryRun) {
			await entities.user.put(next).go();
		}
		rewritten++;
	}

	console.log(`[users] scanned=${items.length} rewritten=${rewritten}${dryRun ? " (dry-run)" : ""}`);
}

async function main(): Promise<void> {
	const targets = selectedTargets();
	console.log(`Backfilling content type indexes in table: ${tableName}`);
	console.log(`Targets: ${targets.join(", ")}`);

	if (targets.includes("members")) {
		await backfillMembers();
	}
	if (targets.includes("sponsors")) {
		await backfillSponsors();
	}
	if (targets.includes("locations")) {
		await backfillLocations();
	}
	if (targets.includes("bus")) {
		await backfillBus();
	}
	if (targets.includes("users")) {
		await backfillUsers();
	}

	console.log("Backfill completed.");
}

main().catch((error) => {
	console.error("Backfill failed:", error);
	process.exit(1);
});
