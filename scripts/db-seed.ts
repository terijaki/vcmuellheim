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
 *   bun run db:seed --user email@example.com|password  # Create a Cognito user
 *   bun run db:seed --user email@example.com --password password  # Create a Cognito user (alt format)
 */

import { execSync } from "node:child_process";
import https from "node:https";
import { AdminAddUserToGroupCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand as ScanDocCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import { busSchema, eventSchema, type LocationInput, locationSchema, type MemberInput, memberSchema, newsSchema, sponsorSchema, type TeamInput, teamSchema } from "@/lib/db/schemas";
import { Club } from "@/project.config";
import { getSanitizedBranch } from "@/utils/git";

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

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
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

// Table names
const EVENTS_TABLE = `vcm-events-${CDK_ENVIRONMENT}${branchSuffix}`;
const NEWS_TABLE = `vcm-news-${CDK_ENVIRONMENT}${branchSuffix}`;
const MEMBERS_TABLE = `vcm-members-${CDK_ENVIRONMENT}${branchSuffix}`;
const TEAMS_TABLE = `vcm-teams-${CDK_ENVIRONMENT}${branchSuffix}`;
const LOCATIONS_TABLE = `vcm-locations-${CDK_ENVIRONMENT}${branchSuffix}`;
const SPONSORS_TABLE = `vcm-sponsors-${CDK_ENVIRONMENT}${branchSuffix}`;
const BUS_TABLE = `vcm-bus-${CDK_ENVIRONMENT}${branchSuffix}`;

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

// Handle --user argument
const userArgIndex = args.findIndex((arg) => arg === "--user");
const shouldCreateUser = userArgIndex !== -1;
let userEmail: string | undefined;
let userPassword: string | undefined;

if (shouldCreateUser) {
	const userCredentials = args[userArgIndex + 1];

	// Support two formats:
	// 1. --user "email@example.com|password"
	// 2. --user email@example.com --password password
	if (userCredentials?.includes("|")) {
		// Format: email|password
		const [email, password] = userCredentials.split("|");
		if (!email || !password) {
			console.error("❌ Both email and password must be provided. Use: --user email@example.com|password");
			process.exit(1);
		}
		userEmail = email;
		userPassword = password;
	} else if (userCredentials && !userCredentials.startsWith("--")) {
		// Format: email with separate --password
		userEmail = userCredentials;
		const passwordArgIndex = args.findIndex((arg) => arg === "--password");
		if (passwordArgIndex !== -1) {
			userPassword = args[passwordArgIndex + 1];
		}
		if (!userEmail || !userPassword) {
			console.error("❌ Invalid --user format. Use one of:");
			console.error("   --user email@example.com|password");
			console.error("   --user email@example.com --password password");
			process.exit(1);
		}
	} else {
		console.error("❌ Invalid --user format. Use one of:");
		console.error("   --user email@example.com|password");
		console.error("   --user email@example.com --password password");
		process.exit(1);
	}
}

const locationCache: LocationInput[] = [];
const membersCache: MemberInput[] = [];
const teamCache: TeamInput[] = [];

/**
 * Get the Cognito User Pool ID from CDK stack outputs
 */
function getCognitoUserPoolId(): string {
	const userPoolIdEnv = process.env.COGNITO_USER_POOL_ID;
	if (userPoolIdEnv) {
		return userPoolIdEnv;
	}

	// Try to get from CloudFormation stack outputs
	// Query all stacks for one with ApiStack in the name
	try {
		const stackName = execSync(`aws cloudformation describe-stacks --query "Stacks[?contains(StackName, 'ApiStack')].StackName | [0]" --output text`, { encoding: "utf-8" }).trim();

		if (!stackName) {
			throw new Error("No ApiStack found");
		}

		const output = execSync(`aws cloudformation describe-stacks --stack-name "${stackName}" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text`, {
			encoding: "utf-8",
		}).trim();

		if (output) {
			return output;
		}
	} catch (_error) {
		// Stack might not exist or AWS CLI not configured
	}

	console.error("❌ COGNITO_USER_POOL_ID could not be determined automatically.");
	console.error("   Set COGNITO_USER_POOL_ID environment variable or run 'bun run cdk:deploy' first.");
	process.exit(1);
}

/**
 * Create a Cognito user with email and password
 */
async function createCognitoUser(email: string, password: string): Promise<void> {
	const userPoolId = getCognitoUserPoolId();

	console.log(`\n👤 Creating Cognito user: ${email}...`);

	try {
		// Create user
		await cognitoClient.send(
			new AdminCreateUserCommand({
				UserPoolId: userPoolId,
				Username: email,
				MessageAction: "SUPPRESS", // Don't send welcome email
				TemporaryPassword: password,
			}),
		);

		console.log(`  ✓ User created`);

		// Set permanent password
		await cognitoClient.send(
			new AdminSetUserPasswordCommand({
				UserPoolId: userPoolId,
				Username: email,
				Password: password,
				Permanent: true,
			}),
		);

		console.log(`  ✓ Password set`);

		// Add user to admin group
		await cognitoClient.send(
			new AdminAddUserToGroupCommand({
				UserPoolId: userPoolId,
				Username: email,
				GroupName: "Admin",
			}),
		);

		console.log(`  ✓ Added to admin group`);
		console.log(`✅ User ${email} created successfully`);
	} catch (error) {
		const errorMsg = (error as Error).message || "";
		if (errorMsg.includes("UsernameExistsException")) {
			console.error(`❌ User ${email} already exists`);
		} else {
			console.error(`❌ Failed to create user ${email}:`, error);
		}
		process.exit(1);
	}
}

/**
 * Cleanup function - deletes all items from seeded tables
 */
async function cleanupDatabase() {
	if (CDK_ENVIRONMENT === "prod") {
		console.error("❌ Cannot cleanup production environment!");
		process.exit(1);
	}

	console.log("\n🧹 Cleaning up database tables...");

	const tables = [EVENTS_TABLE, NEWS_TABLE, MEMBERS_TABLE, TEAMS_TABLE, LOCATIONS_TABLE, SPONSORS_TABLE, BUS_TABLE];

	for (const tableName of tables) {
		try {
			let scannedItems = 0;
			let lastEvaluatedKey: Record<string, unknown> | undefined;

			// eslint-disable-next-line no-constant-condition
			while (true) {
				const result = await docClient.send(
					new ScanDocCommand({
						TableName: tableName,
						ExclusiveStartKey: lastEvaluatedKey,
					}),
				);

				if (!result.Items || result.Items.length === 0) {
					break;
				}

				// Delete items in batches - extract all key attributes from scanned items
				const deleteRequests = result.Items.map((item: Record<string, unknown>) => {
					const key: Record<string, unknown> = {};
					key.id = item.id;

					return {
						DeleteRequest: {
							Key: key,
						},
					};
				});

				// DynamoDB BatchWrite has a limit of 25 items per request
				const batchSize = 25;
				for (let i = 0; i < deleteRequests.length; i += batchSize) {
					const batch = deleteRequests.slice(i, i + batchSize);

					const command = new BatchWriteCommand({
						RequestItems: {
							[tableName]: batch,
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
				console.log(`  ✓ Deleted ${scannedItems} items from ${tableName}`);
			} else {
				console.log(`  • ${tableName}: empty`);
			}
		} catch (error) {
			// Table might not exist yet, which is fine
			const errorMsg = (error as Error).message || "";
			if (!errorMsg.includes("ResourceNotFoundException")) {
				console.warn(`  ⚠️  Error cleaning ${tableName}:`, error);
			}
		}
	}

	console.log("✅ Database cleanup completed");
}

/**
 * Helper function to batch write items with proper typing
 */
async function batchWriteItems<T extends Record<string, unknown>>(tableName: string, items: T[]): Promise<void> {
	const batchSize = 25; // DynamoDB batch write limit
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const command = new BatchWriteCommand({
			RequestItems: {
				[tableName]: batch.map((item) => ({
					PutRequest: { Item: item },
				})),
			},
		});

		try {
			await docClient.send(command);
		} catch (error) {
			console.error(`  ✗ Error writing batch to ${tableName}:`, error);
			throw error;
		}
	}
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
			id: crypto.randomUUID(),
			name: "Römerhalle Müllheim",
			description: "Haupttrainingsstätte des VC Müllheim",
			street: "Zum Sportplatz 1",
			postal: "79379",
			city: "Müllheim",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Vereinsheim VC Müllheim",
			description: "Soziale Räume für Mitgliedertreffen und Events",
			street: "Markgrafenstrasse 45",
			postal: "79379",
			city: "Müllheim",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Beach-Anlage Römerhalle",
			description: "Outdoor Beach-Volleyball Plätze",
			street: "Zum Sportplatz 2",
			postal: "79379",
			city: "Müllheim",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
	];

	// Validate against schema
	const validatedLocations = locations.map((loc) => locationSchema.parse(loc));

	await batchWriteItems(LOCATIONS_TABLE, validatedLocations);
	console.log(`✅ Seeded ${validatedLocations.length} locations to ${LOCATIONS_TABLE}`);
	locationCache.push(...validatedLocations);
}

/**
 * Generate fake Members with team references
 */
async function seedMembersData() {
	console.log("\n👥 Seeding members...");

	const members = [
		{
			id: crypto.randomUUID(),
			name: "Max Müller",
			email: "max.mueller@example.com",
			phone: "+49 7622 123456",
			isBoardMember: true,
			isTrainer: true,
			roleTitle: "Trainer Herren 1",
			avatarS3Key: "",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Sarah Schmidt",
			email: "sarah.schmidt@example.com",
			phone: "+49 7622 234567",
			isBoardMember: true,
			isTrainer: true,
			roleTitle: "Trainerin Damen 1",
			avatarS3Key: "",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Thomas Weber",
			email: "thomas.weber@example.com",
			phone: "+49 7622 345678",
			isBoardMember: true,
			roleTitle: "Vereinsvorsitzender",
			createdAt: dayjs().subtract(2, "years").toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Julia Fischer",
			email: "julia.fischer@example.com",
			isBoardMember: false,
			isTrainer: true,
			roleTitle: "Trainerin Jugend",
			avatarS3Key: "",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Klaus Hoffmann",
			email: "klaus.hoffmann@example.com",
			isBoardMember: false,
			isTrainer: false,
			roleTitle: "Schiedsrichter",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Anna Wagner",
			email: "anna.wagner@example.com",
			isBoardMember: false,
			isTrainer: true,
			roleTitle: "Co-Trainer Damen 2",
			avatarS3Key: "",
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
	];

	// Validate against schema
	const validatedMembers = members.map((mem) => memberSchema.parse(mem));

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

	await batchWriteItems(MEMBERS_TABLE, validatedMembers);
	console.log(`✅ Seeded ${validatedMembers.length} members to ${MEMBERS_TABLE}`);

	membersCache.push(...validatedMembers);
}

/**
 * Generate fake Teams with member references
 */
async function seedTeamsData() {
	console.log("\n🏐 Seeding teams...");

	const teams = [
		{
			id: crypto.randomUUID(),
			type: "team" as const,
			name: "Herren 1",
			slug: "herren-1",
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
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "team" as const,
			name: "Damen 1",
			slug: "damen-1",
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
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "team" as const,
			name: "Jugend",
			slug: "jugend",
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
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			type: "team" as const,
			name: "Damen 2",
			slug: "damen-2",
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
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
	];

	// Validate against schema
	const validatedTeams = teams.map((team) => teamSchema.parse(team));

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

	await batchWriteItems(TEAMS_TABLE, validatedTeams);
	console.log(`✅ Seeded ${validatedTeams.length} teams to ${TEAMS_TABLE}`);
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

	await batchWriteItems(NEWS_TABLE, validatedArticles);
	console.log(`✅ Seeded ${validatedArticles.length} news articles to ${NEWS_TABLE}`);
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
			expiryTimestamp: Math.floor(dayjs().add(1, "year").valueOf() / 1000),
			createdAt: dayjs().subtract(2, "years").toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Sporthaus Schmidt",
			description: "Ausrüster für Sportbekleidung und Equipment",
			websiteUrl: "https://www.sporthaus-schmidt.de",
			logoS3Key: "",
			expiryTimestamp: Math.floor(dayjs().add(6, "months").valueOf() / 1000),
			createdAt: dayjs().subtract(1, "year").toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Bäckerei Hoffmann",
			description: "Versorger von Verpflegung bei Heimspielen",
			logoS3Key: "",
			expiryTimestamp: Math.floor(dayjs().add(8, "months").valueOf() / 1000),
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
		},
		{
			id: crypto.randomUUID(),
			name: "Fitness Plus Müllheim",
			description: "Partner für Krafttraining und Sportwissenschaft",
			websiteUrl: "https://www.fitnessplus-muellheim.de",
			logoS3Key: "",
			expiryTimestamp: Math.floor(dayjs().add(10, "months").valueOf() / 1000),
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

	// Add TTL field and write to database
	const sponsorsWithTTL = validatedSponsors.map((sponsor) => ({
		...sponsor,
		TTL: sponsor.expiryTimestamp,
	}));

	await batchWriteItems(SPONSORS_TABLE, sponsorsWithTTL);
	console.log(`✅ Seeded ${sponsorsWithTTL.length} sponsors to ${SPONSORS_TABLE}`);
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
			teamIds: [teamCache[0]?.id],
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
			teamIds: [teamCache[2]?.id],
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

	await batchWriteItems(EVENTS_TABLE, validatedEvents);
	console.log(`✅ Seeded ${validatedEvents.length} events to ${EVENTS_TABLE}`);
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
			from: dayjs().add(7, "days").hour(17).minute(0).second(0).toISOString(),
			to: dayjs().add(7, "days").hour(23).minute(0).second(0).toISOString(),
			ttl: Math.floor(dayjs().add(7, "days").hour(23).valueOf() / 1000),
			createdAt: dayjs().subtract(14, "days").toISOString(),
			updatedAt: dayjs().subtract(2, "days").toISOString(),
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

	await batchWriteItems(BUS_TABLE, validatedBusBookings);
	console.log(`✅ Seeded ${validatedBusBookings.length} bus bookings to ${BUS_TABLE}`);
}

async function main() {
	try {
		// Handle user creation
		if (shouldCreateUser && userEmail && userPassword) {
			await createCognitoUser(userEmail, userPassword);
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
