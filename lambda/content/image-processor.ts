/// <reference types="bun-types" />
/**
 * Lambda function to process uploaded images using Bun.Image
 * Invoked directly with { bucket, key } after admin/seed uploads
 * Generates responsive variants (480px, 800px, 1200px) in JPEG and WebP format
 * Also compresses and overwrites the original image (capped at 5MB)
 */

import type { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type ProcessImagePayload, shouldProcessImageKey } from "@/lib/media/image-processing";
import { IMAGE_SIZES } from "@utils/image-config";
import { Sentry } from "../utils/sentry";
import {
  compressOriginal,
  generateJpegVariant,
  generateWebpVariant,
  getContentTypeForExtension,
  getImageExtension,
} from "./image-utils";

const s3Client = new S3Client();

export interface ProcessingJobResult {
  originalKey: string;
  variants: Record<string, string>;
  success: boolean;
  error?: string;
}

const downloadImageFromS3 = async (
  bucket: string,
  key: string,
): Promise<{ buffer: Buffer; metadata?: Record<string, string> }> => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("No image body received from S3");
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as Readable) {
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), metadata: response.Metadata };
};

const uploadImageToS3 = async (
  bucket: string,
  key: string,
  imageBuffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<void> => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: imageBuffer,
    ContentType: contentType,
    Metadata: metadata,
  });
  await s3Client.send(command);
};

/** Process image and generate variants using Bun.Image */
export const processImage = async (
  bucket: string,
  key: string,
): Promise<Record<string, string>> => {
  const variants: Record<string, string> = {};

  const { buffer: imageBuffer } = await downloadImageFromS3(bucket, key);
  const input = new Uint8Array(imageBuffer);

  const keyParts = key.split("/");
  const filename = keyParts[keyParts.length - 1];
  const baseFilename = filename.replace(/\.[^.]+$/, "");
  const sourceExtension = getImageExtension(filename);
  const originalContentType = getContentTypeForExtension(sourceExtension);
  const outputFolder = key.substring(0, key.lastIndexOf("/"));

  try {
    if (sourceExtension === "gif") {
      await uploadImageToS3(bucket, key, imageBuffer, originalContentType);
      console.log(`Uploaded original GIF to ${key} without recompression`);
    } else {
      const compressedBuffer = await compressOriginal(input, sourceExtension);
      await uploadImageToS3(bucket, key, compressedBuffer, originalContentType);
      console.log(`Uploaded compressed original to ${key}`);
    }
  } catch (error) {
    console.error("Failed to compress and overwrite original:", error);
    throw error;
  }

  for (const size of IMAGE_SIZES) {
    try {
      const jpegBuffer = await generateJpegVariant(input, size);
      const jpegKey = `${outputFolder}/${baseFilename}-${size}w.jpg`;
      await uploadImageToS3(bucket, jpegKey, jpegBuffer, "image/jpeg");
      variants[`${size}w`] = jpegKey;
    } catch (error) {
      console.error(`Failed to generate JPEG variant ${size}w:`, error);
    }

    try {
      const webpBuffer = await generateWebpVariant(input, size);
      const webpKey = `${outputFolder}/${baseFilename}-${size}w.webp`;
      await uploadImageToS3(bucket, webpKey, webpBuffer, "image/webp");
      variants[`${size}w-webp`] = webpKey;
    } catch (error) {
      console.error(`Failed to generate WebP variant ${size}w:`, error);
    }
  }

  return variants;
};

const lambdaHandler = async (event: ProcessImagePayload): Promise<ProcessingJobResult> => {
  const { bucket, key } = event;

  console.log(`Processing image: s3://${bucket}/${key}`);

  if (!shouldProcessImageKey(key)) {
    console.log(`Skipping image key: ${key}`);
    return {
      originalKey: key,
      variants: {},
      success: true,
    };
  }

  try {
    const variants = await processImage(bucket, key);
    console.log(`Generated variants for ${key}:`, variants);

    return {
      originalKey: key,
      variants,
      success: true,
    };
  } catch (error) {
    console.error(`Error processing image: ${error}`);
    return {
      originalKey: key,
      variants: {},
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const handler = Sentry.wrapHandler(lambdaHandler);
