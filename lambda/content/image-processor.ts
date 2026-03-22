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
import { bytesToMB, IMAGE_QUALITY, IMAGE_SIZES, MAX_ORIGINAL_SIZE } from "@utils/image-config";
import type { S3Event } from "aws-lambda";
import { Sentry } from "../utils/sentry";

const s3Client = new S3Client();
const execAsync = promisify(exec);

interface ProcessingJobResult {
	originalKey: string;
	variants: Record<string, string>; // size -> s3Key
	success: boolean;
	error?: string;
}

const getImageExtension = (filename: string): "jpg" | "png" | "gif" | "webp" => {
	const extension = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
	if (extension === "png" || extension === "gif" || extension === "webp") {
		return extension;
	}
	return "jpg";
};

const getContentTypeForExtension = (extension: "jpg" | "png" | "gif" | "webp"): string => {
	switch (extension) {
		case "png":
			return "image/png";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		default:
			return "image/jpeg";
	}
};

const buildCompressedOriginalCommand = (inputPath: string, outputPath: string, extension: "jpg" | "png" | "webp", quality: number): string => {
	if (extension === "png") {
		return `convert "${inputPath}" -auto-orient -resize 2400 -strip -quality ${quality} -define png:compression-level=9 -define png:compression-filter=5 -define png:compression-strategy=1 "${outputPath}"`;
	}

	if (extension === "webp") {
		return `convert "${inputPath}" -auto-orient -resize 2400 -quality ${quality} -strip -format webp "${outputPath}"`;
	}

	return `convert "${inputPath}" -auto-orient -resize 2400 -quality ${quality} -strip -interlace Plane "${outputPath}"`;
};

const downloadImageFromS3 = async (bucket: string, key: string): Promise<{ buffer: Buffer; metadata?: Record<string, string> }> => {
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
	return { buffer: Buffer.concat(chunks), metadata: response.Metadata };
};

const uploadImageToS3 = async (bucket: string, key: string, imageBuffer: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void> => {
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: imageBuffer,
		ContentType: contentType,
		Metadata: metadata,
	});
	await s3Client.send(command);
};

/** Process image and generate variants using ImageMagick */
const processImage = async (bucket: string, uploadKey: string): Promise<Record<string, string>> => {
	const variants: Record<string, string> = {};
	const tempFiles: string[] = [];

	try {
		const { buffer: imageBuffer } = await downloadImageFromS3(bucket, uploadKey);

		// Remove "uploads/" prefix to get final key
		// uploadKey: uploads/news/uuid.jpg -> finalKey: news/uuid.jpg
		const finalKey = uploadKey.replace(/^uploads\//, "");

		const keyParts = finalKey.split("/");
		const filename = keyParts[keyParts.length - 1];
		const baseFilename = filename.replace(/\.[^.]+$/, "");
		const sourceExtension = getImageExtension(filename);
		const originalContentType = getContentTypeForExtension(sourceExtension);

		// Reconstruct output folder: preserve folder structure
		// Path format: {entityType}/{imageId}.{ext}
		// Example: members/avatar-123.jpg
		const outputFolder = finalKey.substring(0, finalKey.lastIndexOf("/"));

		// Save original to temp
		const inputImagePath = `${tmpdir()}/input-${Date.now()}`;
		writeFileSync(inputImagePath, imageBuffer);
		tempFiles.push(inputImagePath);

		// Compress and overwrite original (capped at 5MB)
		try {
			if (sourceExtension === "gif") {
				await uploadImageToS3(bucket, finalKey, imageBuffer, originalContentType);
				console.log(`Uploaded original GIF to ${finalKey} without recompression`);
			} else {
				const compressedOriginalPath = `${tmpdir()}/original-compressed-${Date.now()}.${sourceExtension}`;
				tempFiles.push(compressedOriginalPath);

				// Keep the original format so PNG/WebP uploads preserve transparency.
				let quality = 85;
				let compressed = false;

				while (quality >= 50 && !compressed) {
					try {
						await execAsync(buildCompressedOriginalCommand(inputImagePath, compressedOriginalPath, sourceExtension, quality));

						const compressedSize = readFileSync(compressedOriginalPath).length;
						if (compressedSize <= MAX_ORIGINAL_SIZE) {
							compressed = true;
						} else if (quality > 50) {
							quality -= 5;
						} else {
							console.warn(`Original image still exceeds limit of ${bytesToMB(MAX_ORIGINAL_SIZE, 0)}MB at quality 50 (${compressedSize} bytes)`);
							compressed = true;
						}
					} catch (error) {
						console.error(`Error compressing at quality ${quality}:`, error);
						quality -= 5;
					}
				}

				const compressedBuffer = readFileSync(compressedOriginalPath);
				await uploadImageToS3(bucket, finalKey, compressedBuffer, originalContentType);
				console.log(`Uploaded compressed original to ${finalKey}`);
			}
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
				await execAsync(`convert "${inputImagePath}" -auto-orient -resize ${size} -background white -alpha remove -alpha off -quality ${IMAGE_QUALITY} -strip "${jpegPath}"`);

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
const lambdaHandler = async (event: S3Event): Promise<ProcessingJobResult[]> => {
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

export const handler = Sentry.wrapHandler(lambdaHandler);
