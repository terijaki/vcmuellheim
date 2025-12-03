/**
 * Lambda function to process uploaded images using ImageMagick
 * Triggered by S3 upload events
 * Generates responsive variants (480px, 800px, 1200px) in JPEG and WebP format
 * Also compresses and overwrites the original image (capped at 5MB)
 */

import { exec } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Readable } from "node:stream";
import { promisify } from "node:util";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { S3Event } from "aws-lambda";
import { bytesToMB, IMAGE_QUALITY, IMAGE_SIZES, MAX_ORIGINAL_SIZE } from "@/apps/shared/lib/image-config";

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
	const tempFiles: string[] = [];

	try {
		const imageBuffer = await downloadImageFromS3(bucket, originalKey);
		const keyParts = originalKey.split("/");
		const filename = keyParts[keyParts.length - 1];
		const baseFilename = filename.replace(/\.[^.]+$/, "");

		// Reconstruct output folder: preserve folder structure
		// Path format: {entityType}/{imageId}.{ext}
		// Example: members/avatar-123.jpg
		const outputFolder = originalKey.substring(0, originalKey.lastIndexOf("/"));

		// Save original to temp
		const inputImagePath = `${tmpdir()}/input-${Date.now()}`;
		writeFileSync(inputImagePath, imageBuffer);
		tempFiles.push(inputImagePath);

		// Compress and overwrite original (capped at 5MB)
		try {
			const compressedOriginalPath = `${tmpdir()}/original-compressed-${Date.now()}.jpg`;
			tempFiles.push(compressedOriginalPath);

			// Convert to JPEG with progressive encoding and quality adjusted to keep file size under 5MB
			// Start with quality 85, and dynamically adjust if needed
			let quality = 85;
			let compressed = false;

			while (quality >= 50 && !compressed) {
				try {
					await execAsync(`convert "${inputImagePath}" -auto-orient -resize 2400 -quality ${quality} -strip -interlace Plane "${compressedOriginalPath}"`);

					const compressedSize = readFileSync(compressedOriginalPath).length;
					if (compressedSize <= MAX_ORIGINAL_SIZE) {
						// Successfully under limit
						compressed = true;
					} else if (quality > 50) {
						// Try lower quality
						quality -= 5;
					} else {
						// Even at quality 50, still too large - use it anyway but log warning
						console.warn(`Original image still exceeds limit of ${bytesToMB(MAX_ORIGINAL_SIZE, 0)}MB at quality 50 (${compressedSize} bytes)`);
						compressed = true;
					}
				} catch (error) {
					console.error(`Error compressing at quality ${quality}:`, error);
					quality -= 5;
				}
			}

			// Upload compressed original back to the same key
			const compressedBuffer = readFileSync(compressedOriginalPath);
			await uploadImageToS3(bucket, originalKey, compressedBuffer, "image/jpeg");
			console.log(`Uploaded compressed original back to ${originalKey}`);
		} catch (error) {
			console.error("Failed to compress and overwrite original:", error);
			throw error;
		}

		// Generate variants
		for (const size of IMAGE_SIZES) {
			//  JPEG
			try {
				const jpegPath = `${tmpdir()}/output-${size}w-jpeg-${Date.now()}.jpg`;
				tempFiles.push(jpegPath);
				await execAsync(`convert "${inputImagePath}" -auto-orient -resize ${size} -quality ${IMAGE_QUALITY} -strip "${jpegPath}"`);

				const jpegBuffer = readFileSync(jpegPath);
				const jpegKey = `${outputFolder}/${baseFilename}-${size}w.jpg`;
				await uploadImageToS3(bucket, jpegKey, jpegBuffer, "image/jpeg");
				variants[`${size}w`] = jpegKey;
			} catch (error) {
				console.error(`Failed to generate JPEG variant ${size}w:`, error);
			}

			//  WebP
			try {
				const webpPath = `${tmpdir()}/output-${size}w-webp-${Date.now()}.webp`;
				tempFiles.push(webpPath);
				// Use -auto-orient to respect EXIF orientation, then strip metadata to prevent issues
				await execAsync(`convert "${inputImagePath}" -auto-orient -resize ${size} -quality ${IMAGE_QUALITY} -format webp -strip "${webpPath}"`);

				const webpBuffer = readFileSync(webpPath);
				const webpKey = `${outputFolder}/${baseFilename}-${size}w.webp`;
				await uploadImageToS3(bucket, webpKey, webpBuffer, "image/webp");
				variants[`${size}w-webp`] = webpKey;
			} catch (error) {
				console.error(`Failed to generate WebP variant ${size}w:`, error);
			}
		}
	} catch (error) {
		console.error("Error processing image:", error);
		throw error;
	} finally {
		// Clean up all temporary files
		for (const filePath of tempFiles) {
			try {
				unlinkSync(filePath);
			} catch (error) {
				console.warn(`Failed to delete temp file ${filePath}:`, error);
			}
		}
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
