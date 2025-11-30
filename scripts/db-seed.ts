#!/usr/bin/env bun

/**
 * Database seeding script for development/staging environments
 * Creates fake German data for DynamoDB tables
 *
 * Usage:
 *   bun run db:seed              # Seeds all entities
 *   bun run db:seed --events     # Seeds only events
 *   bun run db:seed --instagram  # Seeds only Instagram posts
 */

import { execSync } from "node:child_process";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import type { InstagramPostItem } from "@/lambda/social/types";
import type { Event } from "@/lib/db/types";
import { getSanitizedBranch } from "@/utils/git";

// Check environment
const CDK_ENVIRONMENT = process.env.CDK_ENVIRONMENT || "dev";
if (CDK_ENVIRONMENT === "prod") {
	console.error("❌ Cannot seed production environment!");
	console.error("   Set CDK_ENVIRONMENT to 'dev' or 'staging' to seed.");
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

// Table names
const INSTAGRAM_TABLE = `instagram-posts-${CDK_ENVIRONMENT}${branchSuffix}`;
const EVENTS_TABLE = `vcm-events-${CDK_ENVIRONMENT}${branchSuffix}`;

// Parse CLI arguments
const args = process.argv.slice(2);
const seedAll = args.length === 0;
const seedInstagram = seedAll || args.includes("--instagram");
const seedEvents = seedAll || args.includes("--events");

/**
 * Generate fake Instagram posts
 */
async function seedInstagramPosts() {
	console.log("\n📸 Seeding Instagram posts...");

	const posts: InstagramPostItem[] = [
		{
			id: "C234567890",
			entityType: "POST",
			timestamp: dayjs().startOf("day").subtract(1, "days").toISOString(),
			type: "Video",
			ownerFullName: "VC Müllheim",
			ownerUsername: "vcmuellheim",
			inputUrl: "https://www.instagram.com/p/C234567890/",
			displayUrl: "https://picsum.photos/1080/1350?random=2",
			videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			caption: "Trainingseindrücke von gestern Abend 🔥 Unsere Jugendmannschaft gibt alles! #nachwuchs #training #vcmuellheim",
			dimensionsHeight: 1350,
			dimensionsWidth: 1080,
			likesCount: 89,
			commentsCount: 12,
			hashtags: ["nachwuchs", "training", "vcmuellheim"],
			updatedAt: dayjs().startOf("day").subtract(5, "days").toISOString(),
			ttl: Math.floor(dayjs().startOf("day").add(57, "days").valueOf() / 1000),
		},
		{
			id: "C345678901",
			entityType: "POST",
			timestamp: dayjs().startOf("day").subtract(3, "days").toISOString(),
			type: "Image",
			ownerFullName: "VC Müllheim",
			ownerUsername: "vcmuellheim",
			inputUrl: "https://www.instagram.com/p/C345678901/",
			displayUrl: "https://picsum.photos/1080/1080?random=3",
			caption: "Beach-Volleyball Turnier am Wochenende! 🏖️☀️ Wer kommt vorbei? Samstag ab 10 Uhr an der Römerhalle. #beachvolleyball #turnier #müllheim",
			dimensionsHeight: 1080,
			dimensionsWidth: 1080,
			likesCount: 156,
			commentsCount: 24,
			hashtags: ["beachvolleyball", "turnier", "müllheim"],
			updatedAt: dayjs().startOf("day").subtract(8, "days").toISOString(),
			ttl: Math.floor(dayjs().startOf("day").add(54, "days").valueOf() / 1000),
		},
		{
			id: "C567890123",
			entityType: "POST",
			timestamp: dayjs().startOf("day").subtract(11, "days").toISOString(),
			type: "Image",
			ownerFullName: "VC Müllheim",
			ownerUsername: "vcmuellheim",
			inputUrl: "https://www.instagram.com/p/C567890123/",
			displayUrl: "https://picsum.photos/1080/1080?random=5",
			caption: "Trainingscamp in den Herbstferien war ein voller Erfolg! 🍂 Danke an alle Teilnehmer und Trainer! #herbstcamp #jugendtraining #vcm",
			dimensionsHeight: 1080,
			dimensionsWidth: 1080,
			likesCount: 94,
			commentsCount: 15,
			hashtags: ["herbstcamp", "jugendtraining", "vcm"],
			updatedAt: dayjs().startOf("day").subtract(15, "days").toISOString(),
			ttl: Math.floor(dayjs().startOf("day").add(47, "days").valueOf() / 1000),
		},
		{
			id: "C678901234",
			entityType: "POST",
			timestamp: dayjs().startOf("day").subtract(20, "days").toISOString(),
			type: "Image",
			ownerFullName: "VC Müllheim",
			ownerUsername: "vcmuellheim",
			inputUrl: "https://www.instagram.com/p/C678901234/",
			displayUrl: "https://picsum.photos/1080/1080?random=6",
			caption: "Neues Trikot-Design für die Saison 2025/26! 👕 Was sagt ihr dazu? #neuestrikots #teamkit #vcmuellheim #volleyball",
			dimensionsHeight: 1080,
			dimensionsWidth: 1080,
			likesCount: 178,
			commentsCount: 42,
			hashtags: ["neuestrikots", "teamkit", "vcmuellheim", "volleyball"],
			updatedAt: dayjs().startOf("day").subtract(20, "days").toISOString(),
			ttl: Math.floor(dayjs().startOf("day").add(42, "days").valueOf() / 1000),
		},
	];

	// Batch write posts
	const batchSize = 25; // DynamoDB batch write limit
	for (let i = 0; i < posts.length; i += batchSize) {
		const batch = posts.slice(i, i + batchSize);
		const command = new BatchWriteCommand({
			RequestItems: {
				[INSTAGRAM_TABLE]: batch.map((post) => ({
					PutRequest: { Item: post },
				})),
			},
		});

		try {
			await docClient.send(command);
			console.log(`  ✓ Seeded ${batch.length} Instagram posts`);
		} catch (error) {
			console.error(`  ✗ Error seeding Instagram posts:`, error);
			throw error;
		}
	}

	console.log(`✅ Seeded ${posts.length} Instagram posts to ${INSTAGRAM_TABLE}`);
}

/**
 * Generate fake Events
 */
async function seedEventsData() {
	console.log("\n📅 Seeding events...");

	const events: Event[] = [
		{
			id: "1",
			type: "event",
			title: "Heimspiel Herren 1 vs. VfB Friedrichshafen",
			description: "Spannende Begegnung unserer ersten Herrenmannschaft gegen den VfB Friedrichshafen in der Landesliga.",
			startDate: dayjs().subtract(3, "days").hour(19).minute(0).second(0).toISOString(),
			endDate: dayjs().subtract(3, "days").hour(21).minute(0).second(0).toISOString(),
			location: "Römerhalle Müllheim",
			variant: "Heimspiel",
			createdAt: dayjs().subtract(10, "days").toISOString(),
			updatedAt: dayjs().subtract(10, "days").toISOString(),
		},
		{
			id: "2",
			type: "event",
			title: "Jugendtraining Special: Sprungkraft",
			description: "Spezielles Trainingsprogramm für unsere Jugendmannschaften mit Fokus auf Sprungkraft und Technik.",
			startDate: dayjs().add(5, "days").hour(17).minute(30).second(0).toISOString(),
			endDate: dayjs().add(5, "days").hour(19).minute(30).second(0).toISOString(),
			location: "Römerhalle Müllheim",
			variant: "Training",
			createdAt: dayjs().subtract(7, "days").toISOString(),
			updatedAt: dayjs().subtract(7, "days").toISOString(),
		},
		{
			id: "3",
			type: "event",
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
			id: "4",
			type: "event",
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
			id: "5",
			type: "event",
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
			id: "6",
			type: "event",
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

	// Insert events one by one
	for (const event of events) {
		const command = new PutCommand({
			TableName: EVENTS_TABLE,
			Item: event,
		});

		try {
			await docClient.send(command);
			console.log(`  ✓ Seeded event: ${event.title}`);
		} catch (error) {
			console.error(`  ✗ Error seeding event "${event.title}":`, error);
			throw error;
		}
	}

	console.log(`✅ Seeded ${events.length} events to ${EVENTS_TABLE}`);
}

/**
 * Main seeding function
 */
async function main() {
	try {
		if (seedInstagram) {
			await seedInstagramPosts();
		}

		if (seedEvents) {
			await seedEventsData();
		}

		console.log("\n🎉 Database seeding completed successfully!\n");
	} catch (error) {
		console.error("\n❌ Database seeding failed:", error);
		process.exit(1);
	}
}

main();
