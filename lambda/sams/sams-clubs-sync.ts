import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getAllSportsclubs, getAssociationByUuid, getAssociations } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { EventBridgeEvent } from "aws-lambda";
import { SAMS } from "@/project.config";
import { slugify } from "@/utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { type ClubItem, ClubItemSchema, SamsClubsSyncLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-clubs-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsClubsSyncLambdaEnvironmentSchema);
const TABLE_NAME = env.CLUBS_TABLE_NAME;
const SAMS_API_KEY = env.SAMS_API_KEY;
const MEDIA_BUCKET_NAME = env.MEDIA_BUCKET_NAME;
const ASSOCIATION_NAME = SAMS.association.name; // SBVV

const s3Client = new S3Client({});

/**
 * Downloads a logo from a URL and uploads it to S3.
 * Returns the S3 key on success, or undefined on failure (non-blocking).
 */
async function uploadLogoToS3(sportsclubUuid: string, logoUrl: string): Promise<string | undefined> {
	try {
		const response = await fetch(logoUrl, {
			signal: AbortSignal.timeout(15_000),
			headers: { "User-Agent": "VCM ClubSync/1.0" },
		});
		if (!response.ok) {
			console.warn(`⚠️ Logo fetch failed for ${sportsclubUuid}: HTTP ${response.status}`);
			return undefined;
		}
		const contentType = response.headers.get("content-type") ?? "image/png";
		const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "png";
		const s3Key = `sams-logos/${sportsclubUuid}.${ext}`;
		const body = Buffer.from(await response.arrayBuffer());
		await s3Client.send(
			new PutObjectCommand({
				Bucket: MEDIA_BUCKET_NAME,
				Key: s3Key,
				Body: body,
				ContentType: contentType,
				CacheControl: "public, max-age=604800",
			}),
		);
		return s3Key;
	} catch (err) {
		console.warn(`⚠️ Logo upload skipped for ${sportsclubUuid}:`, err);
		return undefined;
	}
}

const lambdaHandler = async (event: EventBridgeEvent<string, unknown>) => {
	logger.info("🚀 Starting SAMS clubs sync job", { event });
	Sentry.addBreadcrumb({ category: "sync", message: "Starting SAMS clubs sync", level: "info" });

	if (!SAMS_API_KEY) {
		throw new Error("SAMS_API_KEY environment variable is required");
	}
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
				} else {
					console.log(`ℹ️ Association not found on page ${currentPage} (${data.content.length} Associations: ${data.content.map((a) => a.name).join(", ")}), checking next page...`);
				}
				currentPage++;
			}

			if (data.last === true) hasMorePages = false;
		}

		// Workaround if association still not found. Issue reported on 27.11.2025
		if (!associationUuid) {
			const { data, error, response } = await getAssociationByUuid({
				path: { uuid: "2b7571b5-f985-c552-ea1c-f819ed3811c1" },
				headers: {
					"X-API-Key": SAMS_API_KEY,
				},
			});
			if (error) {
				throw new Error(`Error ${response.status} fetching association by UUID workaround`);
			}
			console.log(`ℹ️ Workaround: Fetched association by known UUID: ${JSON.stringify(data)}`);
			if (data && data.name === ASSOCIATION_NAME) {
				associationUuid = data.uuid;
				console.log(`✅ Found association via workaround: ${ASSOCIATION_NAME} (${associationUuid})`);
			}
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
				const validEntries = data.content.filter((c) => c.uuid && c.name);
				const clubs: ClubItem[] = [];
				for (const c of validEntries) {
					let logoS3Key: string | undefined;
					if (c.logoImageLink) {
						logoS3Key = await uploadLogoToS3(c.uuid as string, c.logoImageLink);
					}
					clubs.push(
						ClubItemSchema.parse({
							type: "club",
							sportsclubUuid: c.uuid,
							name: c.name,
							nameSlug: slugify(c.name),
							associationUuid: c.associationUuid,
							associationName: ASSOCIATION_NAME,
							logoImageLink: c.logoImageLink,
							logoS3Key,
							updatedAt: now,
							ttl,
						}),
					);
				}
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
		Sentry.addBreadcrumb({ category: "sync", message: `Total clubs fetched: ${allClubs.length}`, level: "info", data: { clubsFetched: allClubs.length } });
		Sentry.setMeasurement("sams_clubs_sync.clubs_fetched", allClubs.length, "none");

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
		Sentry.setMeasurement("sams_clubs_sync.clubs_written", totalWritten, "none");
		Sentry.addBreadcrumb({ category: "sync", message: "Clubs sync completed", level: "info", data: { clubsWritten: totalWritten, associationUuid } });

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Clubs sync completed successfully",
				clubsCount: totalWritten,
				associationUuid,
			}),
		};
	} catch (error) {
		logger.error("🚨 Error syncing clubs:", { error });
		Sentry.captureException(error);
		throw error;
	}
};

export const handler = Sentry.wrapHandler(middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)));
