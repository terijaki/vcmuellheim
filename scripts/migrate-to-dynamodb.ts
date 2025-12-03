/**
 * Migration Script: Postgres (Payload CMS) → DynamoDB
 *
 * Migrates data from Payload CMS Postgres backup (JSON export) to DynamoDB tables.
 * Converts Lexical rich text to HTML for the new Tiptap editor.
 *
 * Usage:
 *   1. Export Payload data to JSON:
 *      bun run scripts/export-payload-data.ts > postgres-backup.json
 *
 *   2. Run migration:
 *      bun run scripts/migrate-to-dynamodb.ts --backup=../.temp/postgres-backup.json --dry-run
 *      bun run scripts/migrate-to-dynamodb.ts --backup=../.temp/postgres-backup.json --collection=news
 *      bun run scripts/migrate-to-dynamodb.ts --backup=../.temp/postgres-backup.json --all
 */

import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { busSchema, locationSchema, memberSchema, newsSchema, teamSchema } from "@lib/db/schemas";
import dotenv from "dotenv";
import { Club } from "@/project.config";

// Check for active AWS session
function checkAwsSession() {
	try {
		execSync("aws sts get-caller-identity", { stdio: "ignore" });
	} catch (_err) {
		console.error("❌ No active AWS session found. Please run 'aws login' or authenticate with AWS CLI.");
		process.exit(1);
	}
}
checkAwsSession();

// Type definitions for backup data and Lexical content
interface MediaItem {
	id: string;
	filename: string;
	[key: string]: unknown;
}

interface BackupData {
	media?: MediaItem[];
	events?: Record<string, unknown>[];
	members?: Record<string, unknown>[];
	teams?: Record<string, unknown>[];
	news?: Record<string, unknown>[];
	locations?: Record<string, unknown>[];
	busBookings?: Record<string, unknown>[];
	[key: string]: unknown;
}

interface LexicalNode {
	text?: string;
	format?: number;
	children?: LexicalNode[];
	type?: string;
	listType?: string;
	tag?: string;
	url?: string;
}

interface LexicalData {
	root?: {
		children?: LexicalNode[];
	};
}

// Load .env.production.local for old S3 credentials
dotenv.config({ path: resolve(process.cwd(), ".env.production.local"), override: true });

// Configuration
const AWS_REGION = process.env.CDK_REGION || "eu-central-1";
const ENVIRONMENT = process.env.CDK_ENVIRONMENT || "dev";
const BRANCH = ENVIRONMENT === "prod" ? "" : process.env.GIT_BRANCH || "aws-migration";

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const collection = args.find((arg) => arg.startsWith("--collection="))?.split("=")[1];
const migrateAll = args.includes("--all");
const backupFile = args.find((arg) => arg.startsWith("--backup="))?.split("=")[1];

if (!backupFile) {
	console.error("❌ Please specify --backup=<file.json>");
	console.log("\nFirst, export your Payload data:");
	console.log("  bash scripts/convert-dump-to-json.sh .temp/pg-dump-postgres-1764457205.dmp");
	console.log("\nThen run migration:");
	console.log("  bun run scripts/migrate-to-dynamodb.ts --backup=.temp/postgres-backup.json --all");
	process.exit(1);
}

// Load backup data
let backupData: BackupData;
try {
	const fileContent = readFileSync(backupFile, "utf-8");
	backupData = JSON.parse(fileContent);
	console.log(`📦 Loaded backup from ${backupFile}`);
} catch (error) {
	console.error(`❌ Failed to load backup file: ${error}`);
	process.exit(1);
}

// Setup error logging
const ERROR_LOG_FILE = ".temp/migration-errors.txt";
try {
	writeFileSync(ERROR_LOG_FILE, `Migration Error Log - ${new Date().toISOString()}\n${"=".repeat(60)}\n`);
} catch {
	console.warn(`⚠️  Could not create error log file at ${ERROR_LOG_FILE}`);
}

function logError(message: string): void {
	try {
		appendFileSync(ERROR_LOG_FILE, `${message}\n`);
	} catch {
		// Silently fail if can't write to log
	}
}

/**
 * Throttle helper to add delay between operations
 * Prevents Lambda throttling during migrations
 */
async function throttleDelay(ms: number = 150): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Progress tracker to log activity every N seconds
 * Prevents terminal timeout due to inactivity
 */
class ProgressTracker {
	private lastLogTime = Date.now();
	private readonly logIntervalMs = 30000; // Log every 30 seconds

	logProgress(message: string): void {
		const now = Date.now();
		if (now - this.lastLogTime > this.logIntervalMs) {
			console.log(`   ⏱️  [${new Date().toLocaleTimeString()}] ${message}`);
			this.lastLogTime = now;
		}
	}

	reset(): void {
		this.lastLogTime = Date.now();
	}
}

// Progress tracker used in S3 operations to keep terminal activity logging
const progressTracker = new ProgressTracker();

/**
 * Timeout wrapper for async operations
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
	let timeoutHandle: NodeJS.Timeout | undefined;
	const timeoutPromise = new Promise<T>((_, reject) => {
		timeoutHandle = setTimeout(() => {
			reject(new Error(`Timeout after ${timeoutMs}ms during: ${operationName}`));
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([promise, timeoutPromise]);
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
		}
		return result;
	} catch (error) {
		if (timeoutHandle) {
			clearTimeout(timeoutHandle);
		}
		throw error;
	}
}

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
	marshallOptions: {
		removeUndefinedValues: true,
		convertClassInstanceToMap: true,
	},
});

// Initialize S3 clients for media migration (using credentials from .env.production.local)
const OLD_S3_BUCKET = process.env.S3_BUCKET || "";
const OLD_S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || "";
const OLD_S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || "";

let oldS3Client: S3Client | null = null;
let newS3Client: S3Client | null = null;
let NEW_S3_BUCKET = "";
let MEDIA_CDN_URL = "";

if (OLD_S3_BUCKET && OLD_S3_ACCESS_KEY && OLD_S3_SECRET_KEY) {
	// Old bucket uses us-east-1 (default region for older buckets)
	oldS3Client = new S3Client({
		region: process.env.S3_REGION || "us-east-1",
		credentials: {
			accessKeyId: OLD_S3_ACCESS_KEY,
			secretAccessKey: OLD_S3_SECRET_KEY,
		},
	});
	// New bucket uses eu-central-1 (same as CDK deployment)
	newS3Client = new S3Client({ region: AWS_REGION });
	const branchSuffix = BRANCH ? `-${BRANCH}` : "";
	NEW_S3_BUCKET = `${Club.slug}-media-${ENVIRONMENT}${branchSuffix}`;
	MEDIA_CDN_URL = `https://${ENVIRONMENT}${branchSuffix}-media.new.vcmuellheim.de`;
	console.log("✅ S3 migration enabled");
	console.log(`   Old bucket: ${OLD_S3_BUCKET}`);
	console.log(`   New bucket: ${NEW_S3_BUCKET}`);
} else {
	console.log("⚠️  S3 migration disabled (missing credentials in .env.production.local)");
	console.log("   Avatar/logo S3 keys will be migrated but files won't be copied");
}

/**
 * Copy a file from old S3 bucket to new S3 bucket with timeout
 */
async function copyS3File(oldKey: string, newKey: string, _mediaId: string, filename: string): Promise<string | null> {
	if (!oldS3Client || !newS3Client) {
		return null; // S3 migration disabled
	}

	try {
		// Check if file already exists in new bucket (skip re-upload) - 10s timeout
		try {
			await withTimeout(
				newS3Client.send(
					new HeadObjectCommand({
						Bucket: NEW_S3_BUCKET,
						Key: newKey,
					}),
				),
				10000,
				`HeadObject ${newKey}`,
			);
			// File exists, skip upload
			return `${MEDIA_CDN_URL}/${newKey}`;
		} catch (headError) {
			// File doesn't exist or timeout - continue with download/upload
			if (headError instanceof Error && !headError.message.includes("Timeout")) {
				// Expected NotFound, continue
			}
		}

		// Download file from old bucket - 30s timeout
		console.log(`         ↓ Downloading: ${filename}`);
		const getResponse = await withTimeout(
			oldS3Client.send(
				new GetObjectCommand({
					Bucket: OLD_S3_BUCKET,
					Key: oldKey,
				}),
			),
			30000,
			`GetObject ${oldKey}`,
		);

		if (!getResponse.Body) {
			throw new Error("No file body received");
		}

		// Convert stream to buffer - 30s timeout
		console.log(`         ⧗ Converting...`);
		const bodyBytes = await withTimeout(getResponse.Body.transformToByteArray(), 30000, `transformToByteArray ${filename}`);

		// Upload to new bucket - 30s timeout
		console.log(`         ↑ Uploading...`);
		progressTracker.reset();
		const uploadStart = Date.now();
		await withTimeout(
			newS3Client.send(
				new PutObjectCommand({
					Bucket: NEW_S3_BUCKET,
					Key: newKey,
					Body: bodyBytes,
					ContentType: getResponse.ContentType,
				}),
			),
			30000,
			`PutObject ${newKey}`,
		);
		const uploadTime = Date.now() - uploadStart;

		console.log(`         ✓ Uploaded: ${filename} (${uploadTime}ms)`);
		return `${MEDIA_CDN_URL}/${newKey}`;
	} catch (error) {
		// Silently return null for NotFound/NoSuchKey errors (used when trying multiple key patterns)
		if (error instanceof Error && (error.name === "NotFound" || error.name === "NoSuchKey")) {
			return null;
		}
		// Log other errors
		console.error(`  ⚠️  Failed to copy S3 file ${oldKey}:`);
		const errorMsg = `S3 Copy Error: ${oldKey} - ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
		logError(errorMsg);
		if (error instanceof Error) {
			console.error(`      Error: ${error.name} - ${error.message}`);
		} else {
			console.error(`      Error:`, error);
		}
		return null;
	}
}

/**
 * Migrate a media file by ID to an entity-specific path
 * @param mediaId - The media ID in the backup
 * @param entityType - The entity type (e.g., 'news', 'teams', 'members')
 * @param entityId - The entity ID that owns this image
 * @returns The S3 key (path) if successful, null otherwise
 */
async function migrateMediaFile(mediaId: string, entityType: string): Promise<string | null> {
	const mediaItem = backupData.media?.find((m) => m.id === mediaId);
	if (!mediaItem) {
		console.log(`  ⚠️  Media ${mediaId} not found in backup`);
		return null;
	}

	// Try different S3 key patterns that Payload might use (no media prefix)
	const possibleOldKeys = [
		`${mediaItem.id}/${mediaItem.filename}`, // ID/filename
		mediaItem.filename, // Just filename
	];

	// New S3 key follows pattern: {entityType}/{filename}
	// Flat structure without entity ID nesting
	const newKey = `${entityType}/${mediaItem.filename}`;

	// Try each possible key pattern with timeout handling
	let lastError: Error | null = null;
	for (const oldKey of possibleOldKeys) {
		try {
			const result = await copyS3File(oldKey, newKey, mediaItem.id, mediaItem.filename);
			if (result) {
				return newKey; // Return the S3 key, not the CDN URL
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			console.log(`  ⚠️  Retry with next key pattern...`);
		}
	}

	if (lastError?.message.includes("Timeout")) {
		const timeoutMsg = `TIMEOUT: ${mediaItem.filename} - ${lastError.message}`;
		console.log(`  ⚠️  ${timeoutMsg}`);
		logError(timeoutMsg);
	} else {
		const notFoundMsg = `NOT FOUND: ${mediaItem.filename} (tried ${possibleOldKeys.length} patterns)`;
		console.log(`  ⚠️  ${notFoundMsg}`);
		logError(notFoundMsg);
	}
	return null;
}

// Table names follow environment naming pattern
const getTableName = (entity: string): string => {
	const branchSuffix = BRANCH ? `-${BRANCH}` : "";
	return `vcm-${entity}-${ENVIRONMENT}${branchSuffix}`;
};

/**
 * Convert Lexical JSON to HTML
 * Simplified converter - extracts text and basic formatting
 */
function lexicalToHtml(lexicalData: LexicalData): string {
	if (!lexicalData?.root?.children) {
		return "";
	}

	const convertNode = (node: LexicalNode): string => {
		// Text node
		if (node.text !== undefined) {
			let text = node.text;
			if (node.format) {
				if (node.format & 1) text = `<strong>${text}</strong>`; // Bold
				if (node.format & 2) text = `<em>${text}</em>`; // Italic
				if (node.format & 8) text = `<code>${text}</code>`; // Code
			}
			return text;
		}

		// Element nodes
		const children = node.children?.map(convertNode).join("") || "";

		switch (node.type) {
			case "paragraph":
				return `<p>${children}</p>`;
			case "heading":
				return `<h${node.tag?.replace("h", "") || "2"}>${children}</h${node.tag?.replace("h", "") || "2"}>`;
			case "list":
				return node.listType === "bullet" ? `<ul>${children}</ul>` : `<ol>${children}</ol>`;
			case "listitem":
				return `<li>${children}</li>`;
			case "link":
				return `<a href="${node.url || "#"}">${children}</a>`;
			case "linebreak":
				return "<br>";
			default:
				return children;
		}
	};

	return lexicalData.root.children.map(convertNode).join("");
}

/**
 * Extract plain text from Lexical for excerpt generation
 */
function lexicalToPlainText(lexicalData: LexicalData): string {
	if (!lexicalData?.root?.children) {
		return "";
	}

	const extractText = (node: LexicalNode): string => {
		if (node.text !== undefined) {
			return node.text;
		}
		if (node.children) {
			return node.children.map(extractText).join(" ");
		}
		return "";
	};

	return lexicalData.root.children.map(extractText).join(" ").trim();
}

/**
 * Migrate News collection
 */
async function migrateNews(dryRun: boolean): Promise<void> {
	console.log("\n📰 Migrating News...");

	// biome-ignore lint/suspicious/noExplicitAny: Migration script working with dynamic JSON data
	const rows = (backupData.news || []) as any[];
	console.log(`Found ${rows.length} news articles`);

	let migrated = 0;
	const errors: Array<{ id: string; error: string }> = [];

	for (const row of rows) {
		try {
			console.log(`\n📄 [${migrated + 1}/${rows.length}] ${row.title.substring(0, 60)}...`);

			// Use fallback date if timestamps are null (common with Payload CMS)
			const fallbackDate = new Date("2024-01-01T00:00:00Z").toISOString();
			const createdAt = row.createdAt ? new Date(row.createdAt).toISOString() : fallbackDate;
			const updatedAt = row.publishedDate ? new Date(row.publishedDate).toISOString() : row.updatedAt ? new Date(row.updatedAt).toISOString() : fallbackDate; // transition from publishedDate to updatedAt (on purpose, because this is our new sort key)

			// Convert Lexical to HTML
			const htmlContent = lexicalToHtml(row.content);
			const plainText = lexicalToPlainText(row.content);
			const excerpt = row.excerpt || plainText.substring(0, 500);

			// Generate slug from title
			const slug = row.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "");

			// Upload all images to S3 with entity-specific paths (sequential to avoid throttling)
			const imageS3Keys: string[] = [];
			if (row.imageIds && Array.isArray(row.imageIds) && row.imageIds.length > 0 && oldS3Client && newS3Client) {
				console.log(`   🖼️  Uploading ${row.imageIds.length} images (throttle-safe sequential)...`);
				progressTracker.reset();
				// Upload images sequentially with throttle delays to avoid Lambda throttling
				for (let imgIdx = 0; imgIdx < row.imageIds.length; imgIdx++) {
					const imageId = row.imageIds[imgIdx];
					progressTracker.logProgress(`Processing image ${imgIdx + 1}/${row.imageIds.length}...`);
					try {
						const s3Key = await migrateMediaFile(imageId, "news");
						if (s3Key) {
							imageS3Keys.push(s3Key);
						}
					} catch (imgError) {
						const errMsg = `Article [${migrated + 1}/${rows.length}] ${row.title} - Image ${imgIdx + 1}/${row.imageIds.length}: ${imgError}`;
						console.error(`      ❌ ${errMsg}`);
						logError(errMsg);
					}
					// Add delay between uploads to prevent Lambda throttling (increased from 100ms)
					await throttleDelay(200);
				}
				console.log(`   ✅ Uploaded ${imageS3Keys.length}/${row.imageIds.length} images`);
			}

			const item = newsSchema.parse({
				id: row.id,
				type: "article",
				title: row.title,
				slug,
				content: htmlContent,
				excerpt: excerpt.length < 500 ? excerpt : `${excerpt.substring(0, 497)}...`,
				status: "published",
				imageS3Keys: imageS3Keys.length > 0 ? imageS3Keys : undefined,
				tags: Array.isArray(row.tags) ? row.tags : undefined,
				createdAt,
				updatedAt,
			});

			if (!dryRun) {
				await docClient.send(
					new PutCommand({
						TableName: getTableName("news"),
						Item: item,
					}),
				);
			}

			migrated++;
			if (migrated % 5 === 0) {
				console.log(`  ✓ Migrated ${migrated}/${rows.length} articles`);
			}
			// Add delay between records to prevent Lambda throttling
			await throttleDelay(50);
		} catch (error) {
			errors.push({
				id: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	console.log(`✅ News migration complete: ${migrated}/${rows.length} successful`);
	if (errors.length > 0) {
		console.log(`❌ Errors: ${errors.length}`);
		for (const e of errors) {
			console.log(`  - ${e.id}: ${e.error}`);
		}
	}
}

/**
 * Migrate Events collection
 */
async function migrateEvents(dryRun: boolean): Promise<void> {
	console.log("\n📅 Migrating Events...");

	// biome-ignore lint/suspicious/noExplicitAny: Migration script working with dynamic JSON data
	const rows = (backupData.events || []) as any[];
	console.log(`Found ${rows.length} events`);

	let migrated = 0;
	const errors: Array<{ id: string; error: string }> = [];

	for (const row of rows) {
		try {
			const item = {
				type: "event",
				id: row.id,
				title: row.title,
				description: row.description || "",
				startDate: row.startDate,
				endDate: row.endDate,
				location: row.location,
				variant: row.type,
				teamId: row.teamId,
				relatedSamsMatchId: row.relatedSamsMatchId,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			};

			if (!dryRun) {
				await docClient.send(
					new PutCommand({
						TableName: getTableName("events"),
						Item: item,
					}),
				);
			}

			migrated++;
		} catch (error) {
			errors.push({
				id: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		// Add delay between records to prevent Lambda throttling (increased from 50ms)
		await throttleDelay(150);
	}

	console.log(`✅ Events migration complete: ${migrated}/${rows.length} successful`);
	if (errors.length > 0) {
		console.log(`❌ Errors: ${errors.length}`);
	}
}

/**
 * Migrate Members collection
 */
async function migrateMembers(dryRun: boolean): Promise<void> {
	console.log("\n👥 Migrating Members...");

	// biome-ignore lint/suspicious/noExplicitAny: Migration script working with dynamic JSON data
	const rows = (backupData.members || []) as any[];
	console.log(`Found ${rows.length} members`);

	let migrated = 0;
	const errors: Array<{ id: string; error: string }> = [];

	for (const row of rows) {
		try {
			const createdAt = new Date(row.createdAt).toISOString();
			const updatedAt = new Date(row.updatedAt).toISOString();

			// Upload avatar to S3 with entity-specific path
			let avatarS3Key: string | undefined;
			console.log(`  [${row.id}] avatarS3Key:`, row.avatarS3Key);
			if (row.avatarS3Key && oldS3Client && newS3Client) {
				const s3Key = await migrateMediaFile(row.avatarS3Key, "members");
				if (s3Key) {
					avatarS3Key = s3Key;
				}
			} // Enhanced role handling
			let isBoardMember = false;
			let isTrainer = false;
			let roleTitle: string | undefined;
			if (Array.isArray(row.roles) && row.roles.length > 0) {
				isTrainer = row.roles.includes("Trainer");
				isBoardMember = row.roles.some((role: string) => ["1. Vorsitzender", "2. Vorsitzender", "Beisitzer", "Kassier", "Mitgliederverwaltung", "Schatzmeister"].includes(role));
				// Find the first non-Trainer role
				roleTitle = row.roles.find((r: string) => r !== "Trainer");
			}

			const item = memberSchema.parse({
				id: row.id,
				name: row.name,
				email: row.email || undefined,
				phone: row.phone || undefined,
				avatarS3Key,
				roleTitle,
				isBoardMember,
				isTrainer,
				createdAt,
				updatedAt,
			});

			if (!dryRun) {
				await docClient.send(
					new PutCommand({
						TableName: getTableName("members"),
						Item: item,
					}),
				);
			}

			migrated++;
		} catch (error) {
			errors.push({
				id: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		// Add delay between records to prevent Lambda throttling (increased from 50ms)
		await throttleDelay(150);
	}

	console.log(`✅ Members migration complete: ${migrated}/${rows.length} successful`);
	if (errors.length > 0) {
		console.log(`❌ Errors: ${errors.length}`);
		for (const e of errors) {
			console.log(`  - ${e.id}: ${e.error}`);
		}
	}
}

/**
 * Migrate Teams collection
 */
async function migrateTeams(dryRun: boolean): Promise<void> {
	console.log("\n🏐 Migrating Teams...");

	// biome-ignore lint/suspicious/noExplicitAny: Migration script working with dynamic JSON data
	const rows = (backupData.teams || []) as any[];
	console.log(`Found ${rows.length} teams`);

	let migrated = 0;
	const errors: Array<{ id: string; error: string }> = [];

	for (const row of rows) {
		try {
			// Convert dates to UTC ISO format
			const createdAt = new Date(row.createdAt).toISOString();
			const updatedAt = new Date(row.updatedAt).toISOString();

			// Upload team pictures to S3 with entity-specific paths
			let pictureS3Keys: string[] | undefined;
			if (row.imageIds && Array.isArray(row.imageIds) && oldS3Client && newS3Client) {
				const uploadedKeys: string[] = [];
				for (const imageId of row.imageIds) {
					if (imageId) {
						const s3Key = await migrateMediaFile(imageId, "teams");
						if (s3Key) {
							uploadedKeys.push(s3Key);
						}
						// Add delay between uploads to prevent Lambda throttling (increased from 100ms)
						await throttleDelay(200);
					}
				}
				if (uploadedKeys.length > 0) {
					pictureS3Keys = uploadedKeys;
				}
			}
			const item = teamSchema.parse({
				type: "team",
				id: row.id,
				name: row.name,
				slug: row.slug,
				description: row.description || undefined,
				sbvvTeamId: row.sbvvTeamId || undefined,
				ageGroup: row.age ? String(row.age) : undefined,
				gender: row.gender,
				league: row.league || undefined,
				pointOfContactIds: row.pointOfContactIds || undefined,
				trainerIds: row.trainerIds || undefined,
				pictureS3Keys,
				trainingSchedules: row.trainingSchedules,
				createdAt,
				updatedAt,
			});

			if (!dryRun) {
				await docClient.send(
					new PutCommand({
						TableName: getTableName("teams"),
						Item: item,
					}),
				);
			}

			migrated++;
		} catch (error) {
			errors.push({
				id: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		// Add delay between records to prevent Lambda throttling (increased from 50ms)
		await throttleDelay(150);
	}

	console.log(`✅ Teams migration complete: ${migrated}/${rows.length} successful`);
	if (errors.length > 0) {
		console.log(`❌ Errors: ${errors.length}`);
		for (const e of errors) {
			console.log(`  - ${e.id}: ${e.error}`);
		}
	}
}

/**
 * Migrate Locations collection
 */
async function migrateLocations(dryRun: boolean): Promise<void> {
	console.log("\n📍 Migrating Locations...");

	// biome-ignore lint/suspicious/noExplicitAny: Migration script working with dynamic JSON data
	const rows = (backupData.locations || []) as any[];
	console.log(`Found ${rows.length} locations`);

	let migrated = 0;
	const errors: Array<{ id: string; error: string }> = [];

	for (const row of rows) {
		try {
			// Convert dates to UTC ISO format
			const createdAt = new Date(row.createdAt).toISOString();
			const updatedAt = new Date(row.updatedAt).toISOString();

			const item = locationSchema.parse({
				id: row.id,
				name: row.name,
				description: row.description || "",
				street: row.addressStreet || "",
				postal: String(row.addressPostalCode || ""),
				city: row.addressCity || "",
				createdAt,
				updatedAt,
			});

			if (!dryRun) {
				await docClient.send(
					new PutCommand({
						TableName: getTableName("locations"),
						Item: item,
					}),
				);
			}

			migrated++;
		} catch (error) {
			errors.push({
				id: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		// Add delay between records to prevent Lambda throttling (increased from 50ms)
		await throttleDelay(150);
	}

	console.log(`✅ Locations migration complete: ${migrated}/${rows.length} successful`);
	if (errors.length > 0) {
		console.log(`❌ Errors: ${errors.length}`);
		for (const e of errors) {
			console.log(`  - ${e.id}: ${e.error}`);
		}
	}
}

/**
 * Migrate Bus Bookings collection
 */
async function migrateBusBookings(dryRun: boolean): Promise<void> {
	console.log("\n🚌 Migrating Bus Bookings...");

	// biome-ignore lint/suspicious/noExplicitAny: Migration script working with dynamic JSON data
	const rows = (backupData.busBookings || []) as any[];
	console.log(`Found ${rows.length} bus bookings`);

	let migrated = 0;
	const errors: Array<{ id: string; error: string }> = [];

	for (const row of rows) {
		try {
			// Calculate TTL: 2 years from scheduleEnd
			const scheduleEndDate = new Date(row.scheduleEnd);
			const ttl = Math.floor(scheduleEndDate.getTime() / 1000) + 2 * 365 * 24 * 60 * 60;

			// Convert dates to UTC ISO format (ending in Z)
			const from = new Date(row.scheduleStart).toISOString();
			const to = new Date(row.scheduleEnd).toISOString();
			const createdAt = new Date(row.createdAt).toISOString();
			const updatedAt = new Date(row.updatedAt).toISOString();

			const item = busSchema.parse({
				id: row.id,
				driver: row.traveler || "Unknown",
				comment: row.comment || "",
				from,
				to,
				ttl,
				createdAt,
				updatedAt,
			});

			if (!dryRun) {
				await docClient.send(
					new PutCommand({
						TableName: getTableName("bus"),
						Item: item,
					}),
				);
			}

			migrated++;
		} catch (error) {
			errors.push({
				id: row.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
		// Add delay between records to prevent Lambda throttling (increased from 50ms)
		await throttleDelay(150);
	}

	console.log(`✅ Bus Bookings migration complete: ${migrated}/${rows.length} successful`);
	if (errors.length > 0) {
		console.log(`❌ Errors: ${errors.length}`);
		for (const e of errors) {
			console.log(`  - ${e.id}: ${e.error}`);
		}
	}
}

/**
 * Main migration orchestrator
 */
async function main() {
	console.log("🚀 Payload → DynamoDB Migration");
	console.log(`Environment: ${ENVIRONMENT}`);
	console.log(`Branch: ${BRANCH}`);
	console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);

	if (migrateAll) {
		console.log("Collections: ALL (locations, busBookings, members, teams, news, events)");
	} else if (collection) {
		console.log(`Collection: ${collection}`);
	}

	if (!collection && !migrateAll) {
		console.error("\n❌ Please specify --collection=<name> or --all");
		console.log("\nAvailable options:");
		console.log("  --collection=locations      Migrate locations");
		console.log("  --collection=busBookings    Migrate bus bookings");
		console.log("  --collection=members        Migrate members (with avatars)");
		console.log("  --collection=teams          Migrate teams (with pictures)");
		console.log("  --collection=news           Migrate news (with image galleries)");
		console.log("  --collection=events         Migrate events");
		console.log("  --all                       Migrate all collections");
		console.log("\nOptional flags:");
		console.log("  --dry-run                   Preview migration without writing to DynamoDB");
		process.exit(1);
	}

	try {
		// Migrate in dependency order: simple entities first, then complex ones
		if (collection === "locations" || migrateAll) {
			await migrateLocations(isDryRun);
		}
		if (collection === "busBookings" || migrateAll) {
			await migrateBusBookings(isDryRun);
		}
		if (collection === "members" || migrateAll) {
			await migrateMembers(isDryRun);
		}
		if (collection === "teams" || migrateAll) {
			await migrateTeams(isDryRun);
		}
		if (collection === "news" || migrateAll) {
			await migrateNews(isDryRun);
		}
		if (collection === "events" || migrateAll) {
			await migrateEvents(isDryRun);
		}

		console.log("\n✅ Migration complete!");
		if (isDryRun) {
			console.log("ℹ️  This was a dry run. Run without --dry-run to actually migrate data.");
		}
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		process.exit(1);
	}
}

main();
