#!/usr/bin/env bun

/**
 * Data migration script: reads items from the old per-entity DynamoDB tables and
 * writes them into the new single content table via ElectroDB.
 *
 * Run this AFTER deploying the new stack so the target table already exists.
 * The old source tables are not modified; items are written with upsert semantics so
 * the script is safe to re-run.
 *
 * Usage:
 *   bun run db:migrate                        # Migrate all entities  prod → dev
 *   bun run db:migrate --source-env prod      # Explicit source env (default: prod)
 *   bun run db:migrate --target-env dev       # Explicit target env (default: dev)
 *   bun run db:migrate --news                 # Migrate only news articles
 *   bun run db:migrate --events               # Migrate only events
 *   bun run db:migrate --teams                # Migrate only teams
 *   bun run db:migrate --members              # Migrate only members
 *   bun run db:migrate --locations            # Migrate only locations
 *   bun run db:migrate --sponsors             # Migrate only sponsors
 *   bun run db:migrate --bus                  # Migrate only bus bookings
 *   bun run db:migrate --users                # Migrate only CMS users
 *   bun run db:migrate --dry-run              # Print counts only, no writes
 *
 * The source tables follow the old naming convention:
 *   vcm-{entity}-{sourceEnv}    e.g. vcm-news-prod, vcm-teams-prod
 *
 * The target table follows the new convention:
 *   vcm-content-{targetEnv}     e.g. vcm-content-dev
 */

import { execSync } from "node:child_process";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createDb } from "@/lib/db/electrodb-client";
import { busSchema, cmsUserSchema, eventSchema, locationSchema, memberSchema, newsSchema, sponsorSchema, teamSchema } from "@/lib/db/schemas";
import { getSanitizedBranch } from "@/utils/git";

// ---------------------------------------------------------------------------
// Environment setup
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArgValue(flag: string): string | undefined {
	const idx = args.indexOf(flag);
	return idx !== -1 ? args[idx + 1] : undefined;
}

const SOURCE_ENV = getArgValue("--source-env") ?? "prod";
const TARGET_ENV = getArgValue("--target-env") ?? process.env.CDK_ENVIRONMENT ?? "dev";
const DRY_RUN = args.includes("--dry-run");

// No branch suffix for prod source tables (they never had one)
// The target env respects the current git branch suffix (for dev/feature tables)
const sanitizedBranch = getSanitizedBranch();
const targetBranchSuffix = TARGET_ENV === "prod" ? "" : sanitizedBranch ? `-${sanitizedBranch}` : "";

const TARGET_TABLE = `vcm-content-${TARGET_ENV}${targetBranchSuffix}`;

// Old per-entity table names (source — no branch suffix by default for prod)
const SOURCE_BRANCH_SUFFIX = SOURCE_ENV === "prod" ? "" : sanitizedBranch ? `-${sanitizedBranch}` : "";
const SOURCE_TABLES = {
	news: `vcm-news-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	events: `vcm-events-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	teams: `vcm-teams-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	members: `vcm-members-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	locations: `vcm-locations-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	sponsors: `vcm-sponsors-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	bus: `vcm-bus-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
	users: `vcm-users-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`,
};

// Guard against accidentally writing to prod
if (TARGET_ENV === "prod") {
	console.error("❌ Refusing to write to production target. Use --target-env dev or omit for default dev.");
	process.exit(1);
}

console.log(`🔄 Migration: ${SOURCE_ENV} → ${TARGET_ENV}`);
console.log(`   Source tables: vcm-{entity}-${SOURCE_ENV}${SOURCE_BRANCH_SUFFIX}`);
console.log(`   Target table:  ${TARGET_TABLE}`);
if (DRY_RUN) console.log("   Mode: DRY RUN (no writes)");

// ---------------------------------------------------------------------------
// AWS setup
// ---------------------------------------------------------------------------

function checkAwsSession() {
	try {
		execSync("aws sts get-caller-identity", { stdio: "ignore" });
	} catch (_err) {
		console.error("❌ No active AWS session found. Please authenticate with AWS CLI.");
		process.exit(1);
	}
}
checkAwsSession();

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? "eu-central-1" });
const docClient = DynamoDBDocumentClient.from(dynamo);
// entities is always created (even in dry-run); writes are guarded by DRY_RUN checks in each function
const entities = createDb(docClient, TARGET_TABLE);

// ---------------------------------------------------------------------------
// Generic scan helper
// ---------------------------------------------------------------------------

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
	const items: Record<string, unknown>[] = [];
	let lastKey: Record<string, unknown> | undefined;

	try {
		while (true) {
			const result = await docClient.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastKey }));
			if (result.Items) {
				items.push(...(result.Items as Record<string, unknown>[]));
			}
			lastKey = result.LastEvaluatedKey;
			if (!lastKey) break;
		}
	} catch (error) {
		const msg = (error as Error).message ?? "";
		if (msg.includes("ResourceNotFoundException")) {
			console.warn(`  ⚠️  Table ${tableName} not found — skipping`);
			return [];
		}
		throw error;
	}

	return items;
}

// ---------------------------------------------------------------------------
// Per-entity migration helpers
// ---------------------------------------------------------------------------

async function migrateNews() {
	console.log("\n📰 Migrating news articles...");
	const raw = await scanAll(SOURCE_TABLES.news);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.news}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = newsSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid news item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.news.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} news articles (${skip} skipped)`);
}

async function migrateEvents() {
	console.log("\n📅 Migrating events...");
	const raw = await scanAll(SOURCE_TABLES.events);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.events}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = eventSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid event item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.event.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} events (${skip} skipped)`);
}

async function migrateTeams() {
	console.log("\n🏐 Migrating teams...");
	const raw = await scanAll(SOURCE_TABLES.teams);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.teams}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = teamSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid team item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.team.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} teams (${skip} skipped)`);
}

async function migrateMembers() {
	console.log("\n👥 Migrating members...");
	const raw = await scanAll(SOURCE_TABLES.members);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.members}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = memberSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid member item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.member.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} members (${skip} skipped)`);
}

async function migrateLocations() {
	console.log("\n📍 Migrating locations...");
	const raw = await scanAll(SOURCE_TABLES.locations);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.locations}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = locationSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid location item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.location.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} locations (${skip} skipped)`);
}

async function migrateSponsors() {
	console.log("\n💰 Migrating sponsors...");
	const raw = await scanAll(SOURCE_TABLES.sponsors);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.sponsors}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = sponsorSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid sponsor item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.sponsor.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} sponsors (${skip} skipped)`);
}

async function migrateBus() {
	console.log("\n🚌 Migrating bus bookings...");
	const raw = await scanAll(SOURCE_TABLES.bus);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.bus}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = busSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid bus item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.bus.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} bus bookings (${skip} skipped)`);
}

async function migrateUsers() {
	console.log("\n👤 Migrating CMS users...");
	const raw = await scanAll(SOURCE_TABLES.users);
	console.log(`  Found ${raw.length} items in ${SOURCE_TABLES.users}`);
	if (raw.length === 0 || DRY_RUN) return;

	let ok = 0;
	let skip = 0;
	for (const item of raw) {
		const result = cmsUserSchema.safeParse(item);
		if (!result.success) {
			console.warn(`  ⚠️  Skipping invalid user item ${item.id}: ${result.error.issues.map((i) => i.message).join(", ")}`);
			skip++;
			continue;
		}
		await entities.user.put(result.data).go();
		ok++;
	}
	console.log(`  ✅ Migrated ${ok} users (${skip} skipped)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Determine which entities to migrate (default: all)
const entityFlags = ["--news", "--events", "--teams", "--members", "--locations", "--sponsors", "--bus", "--users"];
const explicitEntities = args.some((a) => entityFlags.includes(a));

const migrateNewsFlag = !explicitEntities || args.includes("--news");
const migrateEventsFlag = !explicitEntities || args.includes("--events");
const migrateTeamsFlag = !explicitEntities || args.includes("--teams");
const migrateMembersFlag = !explicitEntities || args.includes("--members");
const migrateLocationsFlag = !explicitEntities || args.includes("--locations");
const migrateSponsorsFlag = !explicitEntities || args.includes("--sponsors");
const migrateBusFlag = !explicitEntities || args.includes("--bus");
const migrateUsersFlag = !explicitEntities || args.includes("--users");

async function main() {
	try {
		if (migrateLocationsFlag) await migrateLocations();
		if (migrateMembersFlag) await migrateMembers();
		if (migrateTeamsFlag) await migrateTeams();
		if (migrateNewsFlag) await migrateNews();
		if (migrateSponsorsFlag) await migrateSponsors();
		if (migrateEventsFlag) await migrateEvents();
		if (migrateBusFlag) await migrateBus();
		if (migrateUsersFlag) await migrateUsers();

		console.log("\n🎉 Migration complete!");
		if (DRY_RUN) console.log("   (DRY RUN — no data was written)");
	} catch (error) {
		console.error("❌ Migration failed:", error);
		process.exit(1);
	}
}

main();
