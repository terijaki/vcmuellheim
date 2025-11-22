import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { EventBridgeEvent } from "aws-lambda";
import { getAllSportsclubs, getAssociations } from "@/data/sams/client";
import { SAMS } from "@/project.config";
import { slugify } from "@/utils/slugify";
import { type ClubItem, ClubItemSchema } from "./types";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.CLUBS_TABLE_NAME;
const SAMS_API_KEY = process.env.SAMS_API_KEY;
const ASSOCIATION_NAME = SAMS.association.name; // SBVV

export const handler = async (event: EventBridgeEvent<string, unknown>) => {
	console.log("🚀 Starting SAMS clubs sync job", { event });

	if (!TABLE_NAME) {
		throw new Error("CLUBS_TABLE_NAME environment variable is not set");
	}

	try {
		// Step 1: Get association UUID by name
		console.log(`🔍 Finding association: ${ASSOCIATION_NAME}`);
		let associationUuid: string | undefined;
		let currentPage = 0;
		let hasMorePages = true;

		while (hasMorePages) {
			const { data, error, response } = await getAssociations({
				query: { page: currentPage, size: 100 },
				headers: {
					"X-API-Key": SAMS_API_KEY,
				},
			});

			if (error) {
				throw new Error(`Error ${response.status} fetching associations page ${currentPage}`);
			}

			if (data.content) {
				const association = data.content.find((a) => a.name === ASSOCIATION_NAME);
				if (association?.uuid) {
					associationUuid = association.uuid;
					console.log(`✅ Found association: ${ASSOCIATION_NAME} (${associationUuid})`);
					break;
				}
				currentPage++;
			}

			if (data.last === true) hasMorePages = false;
		}

		if (!associationUuid) {
			throw new Error(`Association "${ASSOCIATION_NAME}" not found`);
		}

		// Step 2: Fetch all clubs from SAMS API
		console.log(`🔁 Fetching all clubs for association ${associationUuid}`);
		const allClubs: ClubItem[] = [];
		currentPage = 0;
		hasMorePages = true;

		while (hasMorePages) {
			const { data, error, response } = await getAllSportsclubs({
				query: {
					association: associationUuid,
					page: currentPage,
					size: 100,
				},
				headers: {
					"X-API-Key": SAMS_API_KEY,
				},
			});

			if (error) {
				throw new Error(`Error ${response.status} fetching clubs page ${currentPage}`);
			}

			if (data.content) {
				const now = new Date().toISOString();
				const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

				// Transform clubs using Zod schema to strip undefined values
				const clubs = data.content
					.filter((c) => c.uuid && c.name) // Only clubs with uuid and name
					.map((c) =>
						ClubItemSchema.parse({
							sportsclubUuid: c.uuid,
							name: c.name,
							nameSlug: slugify(c.name),
							associationUuid: c.associationUuid,
							associationName: ASSOCIATION_NAME,
							logoImageLink: c.logoImageLink,
							updatedAt: now,
							ttl,
						}),
					);
				allClubs.push(...clubs);
				console.log(`📄 Fetched page ${currentPage + 1}/${data.totalPages} (${clubs.length} clubs)`);
				currentPage++;
			}

			if (data.last === true) hasMorePages = false;

			// Rate limiting: wait 500ms between pages
			if (hasMorePages) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		console.log(`✅ Total clubs fetched: ${allClubs.length}`);

		// Step 3: Batch write to DynamoDB (max 25 items per batch)
		console.log("💾 Writing clubs to DynamoDB...");
		const batchSize = 25;
		let totalWritten = 0;

		for (let i = 0; i < allClubs.length; i += batchSize) {
			const batch = allClubs.slice(i, i + batchSize);

			const putRequests = batch.map((club) => ({
				PutRequest: {
					Item: club,
				},
			}));

			await docClient.send(
				new BatchWriteCommand({
					RequestItems: {
						[TABLE_NAME]: putRequests,
					},
				}),
			);

			totalWritten += batch.length;
			console.log(`📝 Wrote batch ${Math.floor(i / batchSize) + 1} (${totalWritten}/${allClubs.length} clubs)`);

			// Rate limiting between batches
			if (i + batchSize < allClubs.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(`✅ Successfully synced ${totalWritten} clubs to DynamoDB`);

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Clubs sync completed successfully",
				clubsCount: totalWritten,
				associationUuid,
			}),
		};
	} catch (error) {
		console.error("🚨 Error syncing clubs:", error);
		throw error;
	}
};
