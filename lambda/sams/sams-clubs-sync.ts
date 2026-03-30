import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAllSportsclubs, getAssociationByUuid, getAssociations } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { EventBridgeEvent } from "aws-lambda";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { SAMS } from "@/project.config";
import { slugify } from "@/utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { SamsClubsSyncLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-clubs-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsClubsSyncLambdaEnvironmentSchema);
const TABLE_NAME = env.SAMS_TABLE_NAME;
const MEDIA_BUCKET_NAME = env.MEDIA_BUCKET_NAME;
const ASSOCIATION_NAME = SAMS.association.name; // SBVV

const s3Client = new S3Client({});
const samsEntities = createSamsDb(docClient, TABLE_NAME);

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

	if (!TABLE_NAME) {
		throw new Error("SAMS_TABLE_NAME environment variable is not set");
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

		// Step 2: Pre-load existing club logo data to avoid overwriting with nulls from the API
		// The paginated SAMS API returns logoImageLink: null for ~245/313 clubs, but we may have
		// previously stored valid values that must be preserved.
		console.log("🔄 Pre-loading existing club logo data from DynamoDB...");
		const existingLogoMap = new Map<string, { logoImageLink?: string; logoS3Key?: string }>();
		const existingResponse = await samsEntities.club.query.byType({ type: "club" }).go({ pages: "all" });
		for (const item of existingResponse.data) {
			existingLogoMap.set(item.sportsclubUuid, {
				logoImageLink: item.logoImageLink ?? undefined,
				logoS3Key: item.logoS3Key ?? undefined,
			});
		}
		console.log(`📋 Pre-loaded logo data for ${existingLogoMap.size} existing clubs`);

		// Step 3: Fetch all clubs from SAMS API and upsert directly
		console.log(`🔁 Fetching all clubs for association ${associationUuid}`);
		let totalWritten = 0;
		currentPage = 0;
		hasMorePages = true;

		while (hasMorePages) {
			const { data, error, response } = await getAllSportsclubs({
				query: {
					association: associationUuid,
					page: currentPage,
					size: 100,
				},
			});

			if (error) {
				throw new Error(`Error ${response.status} fetching clubs page ${currentPage}`);
			}

			if (data.content) {
				const now = new Date().toISOString();
				const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

				const validEntries = data.content.filter((c) => c.uuid && c.name);
				// Phase 1: resolve logos sequentially (rate-limited S3 uploads)
				type ClubUpsertItem = Parameters<typeof samsEntities.club.upsert>[0];
				const pageItems: ClubUpsertItem[] = [];
				for (const c of validEntries) {
					const existing = existingLogoMap.get(c.uuid as string);
					// Use API value if present, otherwise fall back to what was previously stored.
					// The paginated list API returns null for most clubs that do have logos.
					const effectiveLogoUrl = c.logoImageLink || existing?.logoImageLink;
					let logoS3Key = existing?.logoS3Key;
					if (c.logoImageLink) {
						// Fresh URL from API — re-upload to S3 (may overwrite stale cached version)
						const uploaded = await uploadLogoToS3(c.uuid as string, c.logoImageLink);
						if (uploaded) logoS3Key = uploaded;
					}
					pageItems.push({
						type: "club",
						sportsclubUuid: c.uuid as string,
						name: c.name as string,
						nameSlug: slugify(c.name as string),
						...(c.associationUuid ? { associationUuid: c.associationUuid as string } : {}),
						associationName: ASSOCIATION_NAME,
						...(effectiveLogoUrl ? { logoImageLink: effectiveLogoUrl } : {}),
						...(logoS3Key ? { logoS3Key } : {}),
						updatedAt: now,
						ttl,
					});
				}
				// Phase 2: write to DynamoDB in parallel chunks of 25
				const CHUNK_SIZE = 25;
				for (let i = 0; i < pageItems.length; i += CHUNK_SIZE) {
					await Promise.all(pageItems.slice(i, i + CHUNK_SIZE).map((item) => samsEntities.club.upsert(item).go()));
				}
				totalWritten += pageItems.length;
				console.log(`📄 Fetched page ${currentPage + 1}/${data.totalPages} (${pageItems.length} clubs)`);
				currentPage++;
			}

			if (data.last === true) hasMorePages = false;

			// Rate limiting: wait 500ms between pages
			if (hasMorePages) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		console.log(`✅ Total clubs upserted: ${totalWritten}`);
		Sentry.addBreadcrumb({ category: "sync", message: `Total clubs fetched: ${totalWritten}`, level: "info", data: { clubsFetched: totalWritten } });
		Sentry.setMeasurement("sams_clubs_sync.clubs_fetched", totalWritten, "none");

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
