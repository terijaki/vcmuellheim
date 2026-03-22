#!/usr/bin/env bun

/**
 * Database seeding script for development/staging environments
 * Creates fake German data for DynamoDB tables with cross-references between members and teams
 *
 * Usage:
 *   bun run db:seed                    # Seeds all entities
 *   bun run db:seed --cleanup          # Cleanup only (validates prod protection)
 *   bun run db:seed --cleanup --members  # Cleanup + seed members
 *   bun run db:seed --events           # Seeds only events
 *   bun run db:seed --news             # Seeds only news articles
 *   bun run db:seed --members          # Seeds only members
 *   bun run db:seed --teams            # Seeds only teams
 *   bun run db:seed --locations        # Seeds only locations
 *   bun run db:seed --sponsors         # Seeds only sponsors
 *   bun run db:seed --bus              # Seeds only bus bookings
 *   bun run db:seed --user email@example.com  # Create a CMS user (Admin role, passwordless)
 */

import { execSync } from "node:child_process";
import https from "node:https";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand as ScanDocCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import { createDb } from "@/lib/db/electrodb-client";
import { busSchema, eventSchema, type LocationInput, locationSchema, type MemberInput, memberSchema, newsSchema, sponsorSchema, type TeamInput, teamSchema } from "@/lib/db/schemas";
import { Club } from "@/project.config";
import { getSanitizedBranch } from "@/utils/git";
import { slugify } from "@/utils/slugify";

// Check environment
const CDK_ENVIRONMENT = process.env.CDK_ENVIRONMENT || "dev";
if (CDK_ENVIRONMENT === "prod") {
	console.error("❌ Cannot seed production environment!");
	console.error("   Set CDK_ENVIRONMENT to 'dev' to seed.");
	process.exit(1);
}

console.log(`🌱 Seeding database for environment: ${CDK_ENVIRONMENT}`);

// Get git branch for table naming
const sanitizedBranch = getSanitizedBranch();
const branchSuffix = sanitizedBranch ? `-${sanitizedBranch}` : "";

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

// Initialize DynamoDB client
const client = new DynamoDBClient({
	region: process.env.AWS_REGION || "eu-central-1",
});
const docClient = DynamoDBDocumentClient.from(client);

// Initialize S3 client
const s3Client = new S3Client({
	region: process.env.AWS_REGION || "eu-central-1",
});

// S3 bucket configuration
const S3_BUCKET = `${Club.slug}-media-${CDK_ENVIRONMENT}${branchSuffix}`;

/**
 * Download image from URL and upload to S3
 */
async function uploadImageToS3(imageUrl: string, s3Key: string): Promise<string> {
	return new Promise((resolve, reject) => {
		https
			.get(imageUrl, async (response) => {
				// Handle redirects
				if (response.statusCode === 301 || response.statusCode === 302) {
					const redirectUrl = response.headers.location;
					if (redirectUrl) {
						resolve(await uploadImageToS3(redirectUrl, s3Key));
						return;
					}
				}

				if (response.statusCode && response.statusCode >= 400) {
					reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
					return;
				}

				const chunks: Buffer[] = [];

				response.on("data", (chunk) => {
					chunks.push(chunk);
				});

				response.on("end", async () => {
					try {
						const imageBuffer = Buffer.concat(chunks);

						if (imageBuffer.length === 0) {
							reject(new Error("Downloaded image is empty"));
							return;
						}

						const command = new PutObjectCommand({
							Bucket: S3_BUCKET,
							Key: s3Key,
							Body: imageBuffer,
							ContentType: response.headers["content-type"] || "image/jpeg",
						});

						await s3Client.send(command);
						console.log(`  ✓ Uploaded image to s3://${S3_BUCKET}/${s3Key} (${imageBuffer.length} bytes)`);
						resolve(s3Key);
					} catch (error) {
						reject(error);
					}
				});
			})
			.on("error", reject);
	});
}

// Table name — single content table (mirrors the CDK stack)
const CONTENT_TABLE_NAME = `vcm-content-${CDK_ENVIRONMENT}${branchSuffix}`;

// ElectroDB entity map wired to the single content table
const entities = createDb(docClient, CONTENT_TABLE_NAME);

// Parse CLI arguments
const args = process.argv.slice(2);
const cleanupOnly = args.includes("--cleanup") && args.length === 1;
const shouldCleanup = args.includes("--cleanup");

const seedEvents = args.length === 0 || args.includes("--events");
const seedNews = args.length === 0 || args.includes("--news");
const seedMembers = args.length === 0 || args.includes("--members");
const seedTeams = args.length === 0 || args.includes("--teams");
const seedLocations = args.length === 0 || args.includes("--locations");
const seedSponsors = args.length === 0 || args.includes("--sponsors");
const seedBus = args.length === 0 || args.includes("--bus");

// Handle --user argument (email only — passwordless OTP authentication)
const userArgIndex = args.indexOf("--user");
const shouldCreateUser = userArgIndex !== -1;
let userEmail: string | undefined;

if (shouldCreateUser) {
	const email = args[userArgIndex + 1];
	if (!email || email.startsWith("--")) {
		console.error("❌ Email address required. Use: --user email@example.com");
		process.exit(1);
	}
	userEmail = email;
}

const locationCache: LocationInput[] = [];
const membersCache: MemberInput[] = [];
const teamCache: TeamInput[] = [];

/**
 * Create a CMS user (whitelisted email) in the content table via ElectroDB.
 * The user can then sign in via email OTP (passwordless) at the CMS admin panel.
 */
async function createCmsUser(email: string): Promise<void> {
	console.log(`\n👤 Creating CMS user: ${email}...`);

	// Check if user already exists (by email via GSI4)
	const existing = await entities.user.query.byEmail({ email }).go();
	if (existing.data && existing.data.length > 0) {
		console.error(`❌ User ${email} already exists`);
		process.exit(1);
	}

	await entities.user
		.create({
			id: crypto.randomUUID(),
			email,
			name: email.split("@")[0],
			emailVerified: false,
			role: "Admin",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		})
		.go();

	console.log(`✅ CMS user ${email} created (role: Admin)`);
	console.log(`   The user can now sign in at the CMS with email OTP (passwordless).`);
}

/**
 * Cleanup function - deletes all items from the single content table
 */
async function cleanupDatabase() {
	if (CDK_ENVIRONMENT === "prod") {
		console.error("❌ Cannot cleanup production environment!");
		process.exit(1);
	}

	console.log("\n🧹 Cleaning up database...");

	try {
		let scannedItems = 0;
		let lastEvaluatedKey: Record<string, unknown> | undefined;

		while (true) {
			const result = await docClient.send(
				new ScanDocCommand({
					TableName: CONTENT_TABLE_NAME,
					ExclusiveStartKey: lastEvaluatedKey,
				}),
			);

			if (!result.Items || result.Items.length === 0) {
				break;
			}

			// Delete items in batches using the composite pk/sk keys
			const deleteRequests = result.Items.map((item: Record<string, unknown>) => ({
				DeleteRequest: {
					Key: { pk: item.pk, sk: item.sk },
				},
			}));

			// DynamoDB BatchWrite has a limit of 25 items per request
			const batchSize = 25;
			for (let i = 0; i < deleteRequests.length; i += batchSize) {
				const batch = deleteRequests.slice(i, i + batchSize);
				const command = new BatchWriteCommand({
					RequestItems: {
						[CONTENT_TABLE_NAME]: batch,
					},
				});
				await docClient.send(command);
				scannedItems += batch.length;
			}

			lastEvaluatedKey = result.LastEvaluatedKey;
			if (!lastEvaluatedKey) {
				break;
			}
		}

		if (scannedItems > 0) {
			console.log(`  ✓ Deleted ${scannedItems} items from ${CONTENT_TABLE_NAME}`);
		} else {
			console.log(`  • ${CONTENT_TABLE_NAME}: empty`);
		}
	} catch (error) {
		// Table might not exist yet, which is fine
		const errorMsg = (error as Error).message || "";
		if (!errorMsg.includes("ResourceNotFoundException")) {
			console.warn(`  ⚠️  Error cleaning ${CONTENT_TABLE_NAME}:`, error);
		}
	}

	console.log("✅ Database cleanup completed");
}

/**
 * Helper: write an array of items via ElectroDB entity.create().
 * Uses Promise.all so writes are concurrent (no DynamoDB batch size limit to worry about).
 */
async function putItems<T>(entity: { create(item: T): { go(): Promise<unknown> } }, items: T[]): Promise<void> {
	await Promise.all(items.map((item) => entity.create(item).go()));
}

/**
 * Generate UUIDs
 */

/**
 * Generate fake Locations
 */
async function seedLocationsData() {
	console.log("\n📍 Seeding locations...");

	const locations = [
		{
			name: "Römerhalle Müllheim",
			description: "Haupttrainingsstätte des VC Müllheim",
			street: "Zum Sportplatz 1",
			postal: "79379",
			city: "Müllheim",
		},
		{
			name: "Vereinsheim VC Müllheim",
			description: "Soziale Räume für Mitgliedertreffen und Events",
			street: "Markgrafenstrasse 45",
			postal: "79379",
			city: "Müllheim",
		},
		{
			name: "Beach-Anlage Römerhalle",
			description: "Outdoor Beach-Volleyball Plätze",
			street: "Zum Sportplatz 2",
			postal: "79379",
			city: "Müllheim",
		},
	];

	// Add base metadata
	const locationsWithBaseMeta = locations.map((loc) => ({
		...loc,
		id: crypto.randomUUID(),

		createdAt: dayjs().toISOString(),
		updatedAt: dayjs().toISOString(),
	}));

	// Validate against schema
	const validatedLocations = locationsWithBaseMeta.map((loc) => locationSchema.parse(loc));

	await putItems(entities.location, validatedLocations);
	console.log(`✅ Seeded ${validatedLocations.length} locations`);
	locationCache.push(...validatedLocations);
}

/**
 * Generate fake Members with team references
 */
async function seedMembersData() {
	console.log("\n👥 Seeding members...");

	const members = [
		{
			name: "Max Müller",
			email: "max.mueller@example.com",
			phone: "+49 7622 123456",
			isBoardMember: true,
			isTrainer: true,
			roleTitle: "Trainer Herren 1",
			avatarS3Key: "",
		},
		{
			name: "Sarah Hubertschmidt",
			email: "sarah.hubertschmidt@example.com",
			phone: "+49 7622 234567",
			isBoardMember: true,
			isTrainer: true,
			roleTitle: "Trainerin Damen 1",
			avatarS3Key: "",
		},
		{
			name: "Thomas Weber",
			email: "thomas.weber@example.com",
			phone: "+49 7622 345678",
			isBoardMember: true,
			roleTitle: "Kassier",
			createdAt: dayjs().subtract(2, "years").toISOString(),
		},
		{
			name: "Julia Fischer",
			email: "julia.fischer@example.com",
			isBoardMember: false,
			isTrainer: true,
			roleTitle: "Trainerin Jugend",
			avatarS3Key: "",
		},
		{
			name: "Klaus Hoffmann",
			email: "klaus.hoffmann@example.com",
			isBoardMember: false,
			isTrainer: false,
			roleTitle: "Schiedsrichter",
		},
		{
			name: "Anna-Maria Sofie Wagner",
			email: "anna.maria.sofie.wagner@example.com",
			isBoardMember: false,
			isTrainer: true,
			roleTitle: "Co-Trainer Damen 2",
			avatarS3Key: "",
		},
		{
			name: "Peter Lustig",
			email: "peter.lustig@example.com",
			isBoardMember: false,
			isTrainer: true,
			roleTitle: "Mitgliederverwaltung",
		},
	];

	// Add base metadata
	const membersWithBaseMeta = members.map((m) => ({
		id: crypto.randomUUID(),
		createdAt: dayjs().toISOString(),
		updatedAt: dayjs().toISOString(),
		...m, // after the above so dates can be overridden
	}));

	// Validate against schema
	const validatedMembers = membersWithBaseMeta.map((mem) => memberSchema.parse(mem));

	// Avatar URLs to download (only for members with avatarS3Key)
	const avatarUrls = [
		"https://picsum.photos/400/400?random=30",
		"https://picsum.photos/400/400?random=31",
		// Skip Thomas Weber (no avatar)
		"https://picsum.photos/400/400?random=32",
		// Skip Klaus Hoffmann (no avatar)
		"https://picsum.photos/400/400?random=33",
	];

	// Download and upload avatars
	console.log("  Downloading and uploading member avatars...");
	let avatarIndex = 0;
	for (let i = 0; i < validatedMembers.length; i++) {
		const member = validatedMembers[i];
		// Only upload for members with avatar key (those with avatarS3Key property defined)
		if (i === 0 || i === 1 || i === 3 || i === 5) {
			try {
				const uploadKey = `uploads/members/${member.id}-avatar.jpg`;
				const finalKey = `members/${member.id}-avatar.jpg`;
				await uploadImageToS3(avatarUrls[avatarIndex], uploadKey);
				member.avatarS3Key = finalKey; // Store final key (Lambda will move from uploads/)
				avatarIndex++;
				// Delay to avoid overwhelming Lambda
				await new Promise((resolve) => setTimeout(resolve, 200));
			} catch (error) {
				console.warn(`  ⚠️  Failed to upload avatar for member ${member.name}:`, error);
				// Leave empty if upload fails
			}
		}
	}

	await putItems(entities.member, validatedMembers);
	console.log(`✅ Seeded ${validatedMembers.length} members`);

	membersCache.push(...validatedMembers);
}

/**
 * Generate fake Teams with member references
 */
async function seedTeamsData() {
	console.log("\n🏐 Seeding teams...");

	const teams = [
		{
			name: "Herren 1",
			description: "Erste Herrenmannschaft in der Landesliga",
			gender: "male" as const,
			ageGroup: "ab 16",
			league: "Landesliga",
			trainerIds: [membersCache[0]?.id, membersCache[1]?.id].filter(Boolean),
			pointOfContactIds: [membersCache[3]?.id].filter(Boolean),
			pictureS3Keys: [],
			trainingSchedules: [
				{
					days: [1, 3, 5], // Monday, Wednesday, Friday
					startTime: "19:00",
					endTime: "21:00",
					locationId: (locationCache[0]?.id ?? crypto.randomUUID()) as string,
				},
			],
		},
		{
			name: "Damen 1",
			description: "Erste Damenmannschaft in der Oberliga",
			gender: "female" as const,
			ageGroup: "18",
			league: "Oberliga",
			trainerIds: [membersCache[1]?.id].filter(Boolean),
			pointOfContactIds: [membersCache[2]?.id].filter(Boolean),
			pictureS3Keys: [],
			trainingSchedules: [
				{
					days: [2, 4, 6], // Tuesday, Thursday, Saturday
					startTime: "19:30",
					endTime: "21:30",
					locationId: (locationCache[1]?.id ?? crypto.randomUUID()) as string,
				},
			],
		},
		{
			name: "Jugend",
			description: "Jugendmannschaft U18",
			gender: "mixed" as const,
			ageGroup: "12-18 Jahre",
			pointOfContactIds: [membersCache[3]?.id].filter(Boolean),
			trainingSchedules: [
				{
					days: [1, 4], // Monday, Thursday
					startTime: "17:00",
					endTime: "18:30",
					locationId: (locationCache[2]?.id ?? crypto.randomUUID()) as string,
				},
			],
		},
		{
			name: "Damen 2",
			description: "Zweite Damenmannschaft",
			gender: "female" as const,
			league: "Verbandsliga",
			trainerIds: [membersCache[5]?.id].filter(Boolean),
			trainingSchedules: [
				{
					days: [2, 5], // Tuesday, Friday
					startTime: "20:00",
					endTime: "22:00",
					locationId: (locationCache[0]?.id ?? crypto.randomUUID()) as string,
				},
			],
		},
	];

	// create team slugs from names and add dates
	const teamsWithBaseMeta = teams.map((t) => ({
		...t,
		type: "team" as const,
		id: crypto.randomUUID(),
		createdAt: dayjs().toISOString(),
		updatedAt: dayjs().toISOString(),
		slug: slugify(t.name, true),
	}));

	// Validate against schema
	const validatedTeams = teamsWithBaseMeta.map((team) => teamSchema.parse(team));

	// Team picture URLs to download
	const teamPictureUrls = [
		["https://picsum.photos/1200/800?random=40"], // Herren 1
		["https://picsum.photos/1200/800?random=41"], // Damen 1
		// Jugend - no pictures
		// Damen 2 - no pictures
	];

	// Download and upload team pictures
	console.log("  Downloading and uploading team pictures...");
	for (let i = 0; i < validatedTeams.length; i++) {
		const pictureUrls = teamPictureUrls[i] || [];
		// Reset pictureS3Keys to empty array before adding uploaded images
		validatedTeams[i].pictureS3Keys = [];
		for (const pictureUrl of pictureUrls) {
			try {
				const uploadKey = `uploads/teams/${validatedTeams[i].id}-${pictureUrls.indexOf(pictureUrl)}.jpg`;
				const finalKey = `teams/${validatedTeams[i].id}-${pictureUrls.indexOf(pictureUrl)}.jpg`;
				await uploadImageToS3(pictureUrl, uploadKey);
				validatedTeams[i].pictureS3Keys?.push(finalKey); // Store final key (Lambda will move from uploads/)
				// Delay to avoid overwhelming Lambda
				await new Promise((resolve) => setTimeout(resolve, 200));
			} catch (error) {
				console.warn(`  ⚠️  Failed to upload picture for team ${validatedTeams[i].name}:`, error);
				// Continue with next image
			}
		}
	}

	await putItems(entities.team, validatedTeams);
	console.log(`✅ Seeded ${validatedTeams.length} teams`);
	teamCache.push(...validatedTeams);
}

/**
 * Generate fake News articles
 */
async function seedNewsData() {
	console.log("\n📰 Seeding news articles...");

	const articles = [
		{
			id: crypto.randomUUID(),
			type: "article" as const,
			title: "VC Müllheim wird Meister der Landesliga!",
			slug: "vcm-meister-landesliga-2025",
			content:
				"<p>Ein sensationeller Erfolg! Unsere Herren 1 haben in diesem Jahr die Landesliga gewonnen und steigen damit in die Oberliga auf. Herzlichen Glückwunsch an das gesamte Team und besonders an Trainer Max Müller.</p>",
			excerpt: "Großer Erfolg für VC Müllheim: Die Herren 1 gewinnen die Landesliga und steigen auf!",
			status: "published" as const,
			imageS3Keys: [],
			tags: ["herren", "meister", "erfolg"],
			createdAt: dayjs().subtract(5, "days").toISOString(),
			updatedAt: dayjs().subtract(5, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "article" as const,
			title: "Neue Trainerin Julia Fischer im Team",
			slug: "neue-trainerin-julia-fischer",
			content: "<p>Wir freuen uns, Julia Fischer als neue Trainerin der Jugendmannschaft begrüßen zu dürfen. Mit ihrer langjährigen Erfahrung wird sie unsere jungen Talente optimal fördern.</p>",
			excerpt: "Julia Fischer verstärkt unser Trainerteam",
			status: "published" as const,
			imageS3Keys: [],
			tags: ["trainer", "jugend", "mannschaft"],
			createdAt: dayjs().subtract(15, "days").toISOString(),
			updatedAt: dayjs().subtract(15, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "article" as const,
			title: "Jahresrückblick 2024 - Danke für ein fantastisches Jahr!",
			slug: "jahresrueckblick-2024",
			content:
				"<p>Ein ereignisreiches Jahr liegt hinter uns. Wir schauen zurück auf viele spannende Spiele, erfolgreiche Trainingsperioden und wunderbare Momente als Gemeinschaft.</p><p>Danke an alle Spieler, Trainer und Unterstützer!</p>",
			excerpt: "Rückblick auf ein erfolgreiches Jahr 2024",
			status: "published" as const,
			imageS3Keys: [],
			tags: ["rückblick", "danksagung", "gemeinschaft"],
			createdAt: dayjs().subtract(30, "days").toISOString(),
			updatedAt: dayjs().subtract(30, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "article" as const,
			title: "Saisonvorbereitung 2025/26 startet bald",
			slug: "saisonvorbereitung-2025-26",
			content: "<p>Die Vorbereitungen für die neue Saison laufen auf Hochtouren. Alle Teams freuen sich auf ein intensives Training und spannende Matches!</p>",
			excerpt: "Saisonvorbereitung 2025/26 beginnt in Kürze",
			status: "draft" as const,
			imageS3Keys: [],
			tags: ["vorbereitung", "saison", "training"],
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "article" as const,
			title: "Erfolgreiche Saison 2023/24 abgeschlossen",
			slug: "erfolgreiche-saison-2023-24",
			content: "<p>Die vergangene Saison war geprägt von großartigen Leistungen aller Mannschaften. Wir freuen uns auf neue Herausforderungen in der nächsten Saison.</p>",
			excerpt: "Rückblick auf eine erfolgreiche Saison",
			status: "archived" as const,
			imageS3Keys: [],
			tags: ["archiv", "saison", "2023-2024"],
			createdAt: dayjs().subtract(200, "days").toISOString(),
			updatedAt: dayjs().subtract(200, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "article" as const,
			title: "Benefizturnier für den guten Zweck",
			slug: "benefizturnier-guter-zweck",
			content:
				"<p>Dieses Jahr veranstalten wir ein Benefizturnier, bei dem alle Einnahmen an ein lokales Kinderheim gehen. Kommt alle vorbei und unterstützt einen guten Zweck!</p><p>Das Turnier findet am 15. Juni statt. Anmeldungen ab sofort möglich.</p>",
			excerpt: "Großes Benefizturnier für den guten Zweck",
			status: "published" as const,
			imageS3Keys: [],
			tags: ["benefiz", "turnier", "spenden"],
			createdAt: dayjs().subtract(45, "days").toISOString(),
			updatedAt: dayjs().subtract(45, "days").toISOString(),
		},
	];

	// Validate against schema
	const validatedArticles = articles.map((article) => newsSchema.parse(article));

	// Image URLs to download - multiple per article
	const imageUrlSets = [
		["https://picsum.photos/1200/800?random=20", "https://picsum.photos/1200/800?random=21"],
		["https://picsum.photos/1200/800?random=22"],
		["https://picsum.photos/1200/800?random=23", "https://picsum.photos/1200/800?random=24", "https://picsum.photos/1200/800?random=25"],
		[], // Draft article - no images
		["https://picsum.photos/1200/800?random=26"], // Archived - one image
		["https://picsum.photos/1200/800?random=27", "https://picsum.photos/1200/800?random=28"],
	];

	// Download and upload images
	console.log("  Downloading and uploading news images...");
	for (let i = 0; i < validatedArticles.length; i++) {
		const imageUrls = imageUrlSets[i] || [];
		for (const imageUrl of imageUrls) {
			try {
				const uploadKey = `uploads/news/${validatedArticles[i].id}-${imageUrls.indexOf(imageUrl)}.jpg`;
				const finalKey = `news/${validatedArticles[i].id}-${imageUrls.indexOf(imageUrl)}.jpg`;
				await uploadImageToS3(imageUrl, uploadKey);
				validatedArticles[i].imageS3Keys?.push(finalKey); // Store final key (Lambda will move from uploads/)
				// Delay to avoid overwhelming Lambda
				await new Promise((resolve) => setTimeout(resolve, 200));
			} catch (error) {
				console.warn(`  ⚠️  Failed to upload image for article ${validatedArticles[i].title}:`, error);
				// Continue with next image
			}
		}
	}

	await putItems(entities.news, validatedArticles);
	console.log(`✅ Seeded ${validatedArticles.length} news articles`);
}

/**
 * Generate fake Sponsors
 */
async function seedSponsorsData() {
	console.log("\n💰 Seeding sponsors...");

	const sponsors = [
		{
			id: crypto.randomUUID(),
			name: "Müllheim Bank AG",
			description: "Hauptsponsor des VC Müllheim seit 2020",
			websiteUrl: "https://www.muellheimbank.de",
			logoS3Key: "",
			ttl: Math.floor(dayjs().add(1, "year").valueOf() / 1000),
			createdAt: dayjs().subtract(2, "years").toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Sporthaus Schmidt",
			description: "Ausrüster für Sportbekleidung und Equipment",
			websiteUrl: "https://www.sporthaus-schmidt.de",
			logoS3Key: "",
			ttl: Math.floor(dayjs().add(6, "months").valueOf() / 1000),
			createdAt: dayjs().subtract(1, "year").toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Bäckerei Hoffmann",
			description: "Versorger von Verpflegung bei Heimspielen",
			logoS3Key: "",
			ttl: Math.floor(dayjs().add(8, "months").valueOf() / 1000),
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Fitness Plus Müllheim",
			description: "Partner für Krafttraining und Sportwissenschaft",
			websiteUrl: "https://www.fitnessplus-muellheim.de",
			logoS3Key: "",
			ttl: Math.floor(dayjs().add(10, "months").valueOf() / 1000),
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
	];

	// Validate against schema
	const validatedSponsors = sponsors.map((sponsor) => sponsorSchema.parse(sponsor));

	// Logo URLs to download
	const logoUrls = ["https://picsum.photos/400/200?random=30", "https://picsum.photos/400/200?random=31", "https://picsum.photos/400/200?random=32", "https://picsum.photos/400/200?random=33"];

	// Download and upload logos
	console.log("  Downloading and uploading sponsor logos...");
	for (let i = 0; i < validatedSponsors.length; i++) {
		try {
			const uploadKey = `uploads/sponsors/${validatedSponsors[i].id}-logo.jpg`;
			const finalKey = `sponsors/${validatedSponsors[i].id}-logo.jpg`;
			await uploadImageToS3(logoUrls[i], uploadKey);
			validatedSponsors[i].logoS3Key = finalKey; // Store final key (Lambda will move from uploads/)
			// Delay to avoid overwhelming Lambda
			await new Promise((resolve) => setTimeout(resolve, 200));
		} catch (error) {
			console.warn(`  ⚠️  Failed to upload logo for ${validatedSponsors[i].name}:`, error);
			// Continue without logo
		}
	}

	// SponsorEntity uses ttl for DynamoDB-based automatic expiry.
	await putItems(entities.sponsor, validatedSponsors);
	console.log(`✅ Seeded ${validatedSponsors.length} sponsors`);
}

/**
 * Generate fake Events
 */
async function seedEventsData() {
	console.log("\n📅 Seeding events...");

	const events = [
		{
			id: crypto.randomUUID(),
			type: "event" as const,
			title: "Heimspiel Herren 1 vs. VfB Friedrichshafen",
			description: "Spannende Begegnung unserer ersten Herrenmannschaft gegen den VfB Friedrichshafen in der Landesliga.",
			startDate: dayjs().subtract(3, "days").hour(19).minute(0).second(0).toISOString(),
			endDate: dayjs().subtract(3, "days").hour(21).minute(0).second(0).toISOString(),
			location: "Römerhalle Müllheim",
			variant: "Heimspiel",
			createdAt: dayjs().subtract(10, "days").toISOString(),
			updatedAt: dayjs().subtract(10, "days").toISOString(),
			teamIds: [teamCache[0]?.id].filter(Boolean),
		},
		{
			id: crypto.randomUUID(),
			type: "event" as const,
			title: "Jugendtraining Special: Sprungkraft",
			description: "Spezielles Trainingsprogramm für unsere Jugendmannschaften mit Fokus auf Sprungkraft und Technik.",
			startDate: dayjs().add(5, "days").hour(17).minute(30).second(0).toISOString(),
			endDate: dayjs().add(5, "days").hour(19).minute(30).second(0).toISOString(),
			location: "Römerhalle Müllheim",
			variant: "Training",
			createdAt: dayjs().subtract(7, "days").toISOString(),
			updatedAt: dayjs().subtract(7, "days").toISOString(),
			teamIds: [teamCache[2]?.id].filter(Boolean),
		},
		{
			id: crypto.randomUUID(),
			type: "event" as const,
			title: "Beach-Volleyball Turnier",
			description: "Unser jährliches Beach-Volleyball Turnier! Anmeldung bis 31.05. Teams mit 2-4 Spielern willkommen.",
			startDate: dayjs().add(14, "days").hour(10).minute(0).second(0).toISOString(),
			endDate: dayjs().add(15, "days").hour(18).minute(0).second(0).toISOString(),
			location: "Beach-Anlage Römerhalle",
			variant: "Turnier",
			createdAt: dayjs().subtract(20, "days").toISOString(),
			updatedAt: dayjs().subtract(5, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "event" as const,
			title: "Mitgliederversammlung 2025",
			description: "Ordentliche Mitgliederversammlung mit Vorstandswahl und Bericht über das vergangene Vereinsjahr.",
			startDate: dayjs().add(21, "days").hour(19).minute(0).second(0).toISOString(),
			endDate: dayjs().add(21, "days").hour(21).minute(30).second(0).toISOString(),
			location: "Vereinsheim VC Müllheim",
			variant: "Mitgliedertreffen",
			createdAt: dayjs().subtract(30, "days").toISOString(),
			updatedAt: dayjs().subtract(30, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "event" as const,
			title: "Schnuppertraining für Anfänger",
			description: "Du wolltest schon immer Volleyball spielen? Komm vorbei zum kostenlosen Schnuppertraining! Keine Vorkenntnisse nötig.",
			startDate: dayjs().add(7, "days").hour(18).minute(0).second(0).toISOString(),
			endDate: dayjs().add(7, "days").hour(20).minute(0).second(0).toISOString(),
			location: "Römerhalle Müllheim",
			variant: "Training",
			createdAt: dayjs().subtract(14, "days").toISOString(),
			updatedAt: dayjs().subtract(14, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "event" as const,
			title: "Weihnachtsfeier 🎅",
			description: "Gemütliche Weihnachtsfeier für alle Mitglieder, Freunde und Familie. Mit Wichteln, Glühwein und gutem Essen!",
			startDate: dayjs().add(95, "days").hour(18).minute(30).second(0).toISOString(),
			endDate: dayjs().add(95, "days").hour(23).minute(0).second(0).toISOString(),
			location: "Vereinsheim VC Müllheim",
			variant: "Soziales",
			createdAt: dayjs().subtract(25, "days").toISOString(),
			updatedAt: dayjs().subtract(18, "days").toISOString(),
		},
	];

	// Validate against schema
	const validatedEvents = events.map((event) => eventSchema.parse(event));

	await putItems(entities.event, validatedEvents);
	console.log(`✅ Seeded ${validatedEvents.length} events`);
}

/**
 * Generate fake Bus bookings
 */
async function seedBusData() {
	console.log("\n🚌 Seeding bus bookings...");

	const busBookings = [
		{
			id: crypto.randomUUID(),
			driver: "Hans Mueller",
			comment: "Auswärtsspiel Herren 1 in Freiburg - Abfahrt pünktlich um 17:00 Uhr. Bitte 10 Min vorher da sein.",
			from: dayjs().subtract(7, "days").hour(17).minute(0).second(0).toISOString(),
			to: dayjs().subtract(7, "days").hour(23).minute(0).second(0).toISOString(),
			ttl: Math.floor(dayjs().subtract(30, "days").valueOf() / 1000),
			createdAt: dayjs().subtract(14, "days").toISOString(),
			updatedAt: dayjs().subtract(12, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			driver: "Klaus Schmidt",
			comment: "Vereinsfahrt zum Turnier Basel - Overnight trip. Hotel info wird separat verschickt.",
			from: dayjs().add(21, "days").hour(8).minute(0).second(0).toISOString(),
			to: dayjs().add(22, "days").hour(20).minute(0).second(0).toISOString(),
			ttl: Math.floor(dayjs().add(22, "days").hour(20).valueOf() / 1000),
			createdAt: dayjs().subtract(30, "days").toISOString(),
			updatedAt: dayjs().subtract(5, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			driver: "Werner Wagner",
			comment: "Trainingswochenende Schwarzwald - Unterkunft im Vereinsheim. Verpflegung inkl.",
			from: dayjs().add(35, "days").hour(9).minute(30).second(0).toISOString(),
			to: dayjs().add(36, "days").hour(18).minute(0).second(0).toISOString(),
			ttl: Math.floor(dayjs().add(36, "days").hour(18).valueOf() / 1000),
			createdAt: dayjs().subtract(45, "days").toISOString(),
			updatedAt: dayjs().subtract(8, "days").toISOString(),
		},
		{
			id: crypto.randomUUID(),
			driver: "Thomas Klein",
			comment: "Regionales Pokalturnier Offenburg - Tagesfahrt. Mittagessen vor Ort möglich.",
			from: dayjs().add(14, "days").hour(10).minute(0).second(0).toISOString(),
			to: dayjs().add(14, "days").hour(19).minute(0).second(0).toISOString(),
			ttl: Math.floor(dayjs().add(14, "days").hour(19).valueOf() / 1000),
			createdAt: dayjs().subtract(20, "days").toISOString(),
			updatedAt: dayjs().toISOString(),
		},
	];

	// Validate against schema
	const validatedBusBookings = busBookings.map((booking) => busSchema.parse(booking));

	await putItems(entities.bus, validatedBusBookings);
	console.log(`✅ Seeded ${validatedBusBookings.length} bus bookings`);
}

async function main() {
	try {
		// Handle user creation
		if (shouldCreateUser && userEmail) {
			await createCmsUser(userEmail);
			return;
		}

		// Handle cleanup-only mode
		if (cleanupOnly) {
			await cleanupDatabase();
			return;
		}

		// Run cleanup only if --cleanup flag is present
		if (shouldCleanup) {
			await cleanupDatabase();
		}

		// Seed in order of dependencies
		if (seedLocations) {
			await seedLocationsData();
		}

		if (seedMembers) {
			await seedMembersData();
		}

		if (seedTeams) {
			await seedTeamsData();
		}

		if (seedNews) {
			await seedNewsData();
		}

		if (seedSponsors) {
			await seedSponsorsData();
		}

		if (seedEvents) {
			await seedEventsData();
		}

		if (seedBus) {
			await seedBusData();
		}

		console.log("\n🎉 Database seeding completed successfully!\n");
	} catch (error) {
		console.error("\n❌ Database seeding failed:", error);
		process.exit(1);
	}
}

main();
