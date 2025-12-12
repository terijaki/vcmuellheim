/**
 * S3 Cleanup Lambda
 * Triggered by DynamoDB Streams from News, Teams, Members, Media, and Sponsors tables
 * Deletes S3 objects when:
 * 1. REMOVE event: Entity is deleted completely
 * 2. MODIFY event: S3 key fields change (old files replaced with new ones)
 */

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBRecord, DynamoDBStreamEvent, DynamoDBStreamHandler } from "aws-lambda";
import type { z } from "zod";
import { mediaSchema, memberSchema, newsSchema, sponsorSchema, teamSchema } from "../../lib/db/schemas";

const s3Client = new S3Client({});
const MEDIA_BUCKET = process.env.MEDIA_BUCKET_NAME || "";

/**
 * S3 key extraction schemas - extracted from full entity schemas
 * Each schema only includes the S3 key field(s) for that entity type
 */
const newsS3Schema = newsSchema.pick({ imageS3Keys: true });
const teamS3Schema = teamSchema.pick({ pictureS3Keys: true });
const memberS3Schema = memberSchema.pick({ avatarS3Key: true });
const mediaS3Schema = mediaSchema.pick({ s3Key: true });
const sponsorS3Schema = sponsorSchema.pick({ logoS3Key: true });

/**
 * Type-safe unmarshall wrapper
 * aws-lambda.AttributeValue and @aws-sdk/client-dynamodb.AttributeValue are incompatible types,
 * but they represent the same runtime value. We cast to bypass the type conflict and then
 * immediately validate with Zod schemas for runtime safety.
 */
const safeUnmarshall = (item: any) => unmarshall(item) as Record<string, unknown>;

/**
 * Entity-specific extractor configurations using Zod schemas
 * Each extractor knows how to extract S3 keys from a specific entity type
 */
type ExtractorConfig = {
	schema: z.ZodSchema;
	extractKeys: (data: Record<string, unknown>) => string[];
};

const extractors: Record<string, ExtractorConfig> = {
	news: {
		schema: newsS3Schema,
		extractKeys: (data) => {
			const parsed = newsS3Schema.safeParse(data);
			if (!parsed.success) return [];
			return parsed.data.imageS3Keys ?? [];
		},
	},
	teams: {
		schema: teamS3Schema,
		extractKeys: (data) => {
			const parsed = teamS3Schema.safeParse(data);
			if (!parsed.success) return [];
			return parsed.data.pictureS3Keys ?? [];
		},
	},
	members: {
		schema: memberS3Schema,
		extractKeys: (data) => {
			const parsed = memberS3Schema.safeParse(data);
			if (!parsed.success) return [];
			return parsed.data.avatarS3Key ? [parsed.data.avatarS3Key] : [];
		},
	},
	media: {
		schema: mediaS3Schema,
		extractKeys: (data) => {
			const parsed = mediaS3Schema.safeParse(data);
			if (!parsed.success) return [];
			return [parsed.data.s3Key];
		},
	},
	sponsors: {
		schema: sponsorS3Schema,
		extractKeys: (data) => {
			const parsed = sponsorS3Schema.safeParse(data);
			if (!parsed.success) return [];
			return parsed.data.logoS3Key ? [parsed.data.logoS3Key] : [];
		},
	},
};

/**
 * Generic extractor - validates entity and extracts S3 keys with full type safety
 */
function extractS3KeysBySchema(entity: Record<string, unknown>, config: ExtractorConfig): string[] {
	return config.extractKeys(entity);
}

/**
 * Extract table name from DynamoDB stream event ARN
 */
function getTableNameFromArn(arn: string | undefined): string {
	if (!arn) return "";
	// ARN format: arn:aws:dynamodb:region:account:table/table-name/stream/timestamp
	const match = arn.match(/table\/([^/]+)/);
	return match?.[1] ?? "";
}

/**
 * Extract S3 keys to delete from an entity based on its table name
 */
function extractS3Keys(entity: Record<string, unknown>, tableName: string): string[] {
	for (const [key, extractor] of Object.entries(extractors)) {
		if (tableName.includes(key)) {
			return extractS3KeysBySchema(entity, extractor);
		}
	}
	return [];
}

/**
 * Delete an S3 object
 */
async function deleteS3Object(s3Key: string): Promise<void> {
	try {
		await s3Client.send(
			new DeleteObjectCommand({
				Bucket: MEDIA_BUCKET,
				Key: s3Key,
			}),
		);
		console.log(`Deleted S3 object: ${s3Key}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Failed to delete S3 object ${s3Key}: ${errorMessage}`);
		// Don't throw - continue processing other objects
	}
}

/**
 * Find all image files (original + variants) by prefix in S3.
 * - For an image at: `entityType/imageId.jpg`
 * - Finds all objects matching: `entityType/imageId*`
 * - This includes: `imageId.jpg`, `imageId-480w.jpg`, `imageId-480w.webp`, `imageId-800w.jpg`, etc.
 */
async function findImageFilesByPrefix(bucket: string, imageKey: string): Promise<string[]> {
	try {
		// Extract the prefix: everything up to the filename without extension
		const lastSlashIndex = imageKey.lastIndexOf("/");
		const folder = imageKey.substring(0, lastSlashIndex); // e.g., "members"
		const filename = imageKey.substring(lastSlashIndex + 1); // e.g., "avatar.jpg"
		const baseFilename = filename.replace(/\.[^.]+$/, ""); // e.g., "avatar"
		const prefix = `${folder}/${baseFilename}`; // e.g., "members/avatar"

		console.log(`Searching S3 for objects with prefix: ${prefix}`);

		const command = new ListObjectsV2Command({
			Bucket: bucket,
			Prefix: prefix,
		});

		const response = await s3Client.send(command);
		const keys = response.Contents?.map((obj) => obj.Key || "").filter((key) => key !== "") || [];

		console.log(`Found ${keys.length} objects with prefix ${prefix}:`, keys);
		return keys;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Failed to list S3 objects with prefix from ${imageKey}: ${errorMessage}`);
		// Return the original key as fallback - at least delete that
		return [imageKey];
	}
}

/**
 * Compare old and new S3 keys and return only the keys that were removed
 */
function getDeletedS3Keys(oldKeys: string[], newKeys: string[]): string[] {
	const newKeySet = new Set(newKeys);
	return oldKeys.filter((key) => !newKeySet.has(key));
}

/**
 * Process a single DynamoDB stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
	const tableName = getTableNameFromArn(record.eventSourceARN);

	console.log(`Processing ${record.eventName} event from table`, { eventName: record.eventName, tableName });

	if (!record.dynamodb) {
		console.warn("No DynamoDB data in record, skipping");
		return;
	}

	let s3KeysToDelete: string[] = [];

	if (record.eventName === "REMOVE") {
		// REMOVE: Delete all S3 keys from the old image
		if (record.dynamodb.OldImage) {
			const oldEntity = safeUnmarshall(record.dynamodb.OldImage);
			s3KeysToDelete = extractS3Keys(oldEntity, tableName);
			console.log(`REMOVE event: Found ${s3KeysToDelete.length} S3 keys to delete from old entity`, { keys: s3KeysToDelete });
		}
	} else if (record.eventName === "MODIFY") {
		// MODIFY: Compare old and new, delete only the replaced keys
		if (record.dynamodb.OldImage && record.dynamodb.NewImage) {
			const oldEntity = safeUnmarshall(record.dynamodb.OldImage);
			const newEntity = safeUnmarshall(record.dynamodb.NewImage);

			const oldS3Keys = extractS3Keys(oldEntity, tableName);
			const newS3Keys = extractS3Keys(newEntity, tableName);

			s3KeysToDelete = getDeletedS3Keys(oldS3Keys, newS3Keys);
			console.log(`MODIFY event: Found ${s3KeysToDelete.length} replaced S3 keys`, {
				oldKeysCount: oldS3Keys.length,
				newKeysCount: newS3Keys.length,
				deletedKeys: s3KeysToDelete,
			});
		}
	}

	// For image files, dynamically find all related objects by prefix in S3
	// This handles original + all variants (480w, 800w, 1200w, etc.) without hardcoding sizes
	const allKeysToDelete = new Set<string>();
	for (const s3Key of s3KeysToDelete) {
		// Query S3 for all objects matching this image's prefix
		const relatedKeys = await findImageFilesByPrefix(MEDIA_BUCKET, s3Key);
		for (const key of relatedKeys) {
			allKeysToDelete.add(key);
		}
	}

	// Delete all identified S3 objects (originals + variants)
	for (const s3Key of allKeysToDelete) {
		await deleteS3Object(s3Key);
	}
}

export const handler: DynamoDBStreamHandler = async (event: DynamoDBStreamEvent) => {
	console.log("S3 Cleanup Lambda triggered", { recordCount: event.Records.length });

	try {
		for (const record of event.Records) {
			await processRecord(record);
		}
		console.log("S3 Cleanup Lambda completed successfully");
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("S3 Cleanup Lambda error:", errorMessage);
		throw error;
	}
};
