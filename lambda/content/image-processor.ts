/**
 * Lambda function to process uploaded images using ImageMagick
 * Triggered by S3 upload events
 * Generates responsive variants (480px, 800px, 1200px) in JPEG and WebP format
 */

import { exec } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Readable } from "node:stream";
import { promisify } from "node:util";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { S3Event } from "aws-lambda";
import { IMAGE_QUALITY, IMAGE_SIZES } from "@/apps/shared/lib/image-config";

const s3Client = new S3Client();
const execAsync = promisify(exec);

interface ProcessingJobResult {
	originalKey: string;
	variants: Record<string, string>; // size -> s3Key
	success: boolean;
	error?: string;
}

const downloadImageFromS3 = async (bucket: string, key: string): Promise<Buffer> => {
	const command = new GetObjectCommand({ Bucket: bucket, Key: key });
	const response = await s3Client.send(command);

	if (!response.Body) {
		throw new Error("No image body received from S3");
	}

	// Convert stream to buffer
	const chunks: Uint8Array[] = [];
	for await (const chunk of response.Body as Readable) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
};

const uploadImageToS3 = async (bucket: string, key: string, imageBuffer: Buffer, contentType: string): Promise<void> => {
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: imageBuffer,
		ContentType: contentType,
	});
	await s3Client.send(command);
};

/** Process image and generate variants using ImageMagick */
const processImage = async (bucket: string, originalKey: string): Promise<Record<string, string>> => {
	const variants: Record<string, string> = {};

	try {
		const imageBuffer = await downloadImageFromS3(bucket, originalKey);
		const keyParts = originalKey.split("/");
		const filename = keyParts[keyParts.length - 1];
		const baseFilename = filename.replace(/\.[^.]+$/, "");

		// Reconstruct output folder: preserve nested structure
		// Path format: {entityType}/{entityId}/{imageId}.{ext}
		// Example: members/550e8400-e29b-41d4-a716-446655440000/avatar-123.jpg
		const outputFolder = originalKey.substring(0, originalKey.lastIndexOf("/"));

		// Save original to temp
		const inputImagePath = `${tmpdir()}/input-${Date.now()}`;
		writeFileSync(inputImagePath, imageBuffer);

		for (const size of IMAGE_SIZES) {
			//  JPEG
			try {
				const jpegPath = `${tmpdir()}/output-${size}w-jpeg-${Date.now()}.jpg`;
				await execAsync(`convert "${inputImagePath}" -resize ${size} -quality ${IMAGE_QUALITY} "${jpegPath}"`);

				const jpegBuffer = readFileSync(jpegPath);
				const jpegKey = `${outputFolder}/${baseFilename}-${size}w.jpg`;
				await uploadImageToS3(bucket, jpegKey, jpegBuffer, "image/jpeg");
				variants[`${size}w`] = jpegKey;

				unlinkSync(jpegPath);
			} catch (error) {
				console.error(`Failed to generate JPEG variant ${size}w:`, error);
			}

			//  WebP
			try {
				const webpPath = `${tmpdir()}/output-${size}w-webp-${Date.now()}.webp`;
				await execAsync(`convert "${inputImagePath}" -resize ${size} -quality ${IMAGE_QUALITY} -format webp "${webpPath}"`);

				const webpBuffer = readFileSync(webpPath);
				const webpKey = `${outputFolder}/${baseFilename}-${size}w.webp`;
				await uploadImageToS3(bucket, webpKey, webpBuffer, "image/webp");
				variants[`${size}w-webp`] = webpKey;

				unlinkSync(webpPath);
			} catch (error) {
				console.error(`Failed to generate WebP variant ${size}w:`, error);
			}
		}
	} catch (error) {
		console.error("Error processing image:", error);
		throw error;
	}

	return variants;
};

/**
 * Main Lambda handler
 */
export const handler = async (event: S3Event): Promise<ProcessingJobResult[]> => {
	const results: ProcessingJobResult[] = [];

	for (const record of event.Records) {
		try {
			const bucket = record.s3.bucket.name;
			const key = decodeURIComponent(record.s3.object.key);

			console.log(`Processing image: s3://${bucket}/${key}`);

			// Parse S3 key: {folder}/{uuid}.{ext}
			// Example: news/uuid-1234.jpg or news/abc-123/file.jpg
			const parts = key.split("/");
			const filename = parts[parts.length - 1];

			// Skip if already a processed variant (ends with -480w, -800w, -1200w)
			if (/-\d{3,4}w\.\w+$/.test(filename)) {
				console.log(`Skipping already-processed variant: ${key}`);
				continue;
			}

			// Skip non-image files
			if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
				console.log(`Skipping non-image file: ${key}`);
				continue;
			}

			// Process image and generate variants
			const variants = await processImage(bucket, key);

			console.log(`Generated variants for ${key}:`, variants);

			results.push({
				originalKey: key,
				variants,
				success: true,
			});
		} catch (error) {
			console.error(`Error processing image: ${error}`);
			results.push({
				originalKey: `${record.s3.bucket.name}/${record.s3.object.key}`,
				variants: {},
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
};
