import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = process.env.MEDIA_BUCKET_NAME || "";
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || "";

export const uploadRouter = router({
	/** Generate presigned URL for upload */
	getPresignedUrl: protectedProcedure
		.input(
			z.object({
				filename: z.string(),
				contentType: z.string(),
				folder: z.enum(["sponsors", "teams", "members", "news", "media"]).default("media"),
			}),
		)
		.mutation(async ({ input }) => {
			// Extract file extension from original filename
			const fileExtension = input.filename.split(".").pop() || "";
			const sanitizedExtension = fileExtension.toLowerCase().replace(/[^a-z0-9]/g, "");

			// Generate anonymized filename with UUID
			// Use uploads/ prefix to trigger image processing Lambda
			const uuid = randomUUID();
			const uploadKey = sanitizedExtension ? `uploads/${input.folder}/${uuid}.${sanitizedExtension}` : `uploads/${input.folder}/${uuid}`;
			const finalKey = sanitizedExtension ? `${input.folder}/${uuid}.${sanitizedExtension}` : `${input.folder}/${uuid}`;

			const command = new PutObjectCommand({
				Bucket: BUCKET_NAME,
				Key: uploadKey,
				ContentType: input.contentType,
			});

			const presignedUrl = await getSignedUrl(s3Client, command, {
				expiresIn: 300, // 5 minutes
			});

			return {
				uploadUrl: presignedUrl,
				key: finalKey, // Return final key (without uploads/) for DynamoDB
				bucket: BUCKET_NAME,
			};
		}),

	/** Get CloudFront URL for viewing a file */
	getFileUrl: publicProcedure
		.input(
			z.object({
				s3Key: z.string(),
			}),
		)
		.output(z.string().nullable())
		.query(async ({ input }) => {
			if (!input.s3Key) {
				return null;
			}

			// Return CloudFront URL for public access
			if (CLOUDFRONT_URL) {
				return `${CLOUDFRONT_URL}/${input.s3Key}`;
			}

			// Fallback to presigned URL if CloudFront is not configured
			const command = new GetObjectCommand({
				Bucket: BUCKET_NAME,
				Key: input.s3Key,
			});

			const presignedUrl = await getSignedUrl(s3Client, command, {
				expiresIn: 3600, // 1 hour
			});

			return presignedUrl;
		}),

	/** Get URLs for (multiple) S3 keys */
	getFileUrls: publicProcedure
		.input(
			z.object({
				s3Keys: z.array(z.string()).optional().default([]),
			}),
		)
		.output(z.array(z.string()))
		.query(async ({ input }) => {
			const result: string[] = [];
			for (const s3Key of input.s3Keys) {
				if (CLOUDFRONT_URL) {
					result.push(`${CLOUDFRONT_URL}/${s3Key}`);
				} else {
					const command = new GetObjectCommand({
						Bucket: BUCKET_NAME,
						Key: s3Key,
					});
					const url = await getSignedUrl(s3Client, command, {
						expiresIn: 3600,
					});
					result.push(url);
				}
			}
			return result;
		}),
	/** Get URLs for (multiple) S3 keys as a Map */
	getFileUrlsMap: publicProcedure
		.input(
			z.object({
				s3Keys: z.array(z.string()).optional(),
			}),
		)
		.output(z.record(z.string(), z.string()))
		.query(async ({ input }) => {
			const result: Record<string, string> = {};
			const keys = input.s3Keys || [];
			for (const s3Key of keys) {
				if (!s3Key) {
					result[s3Key] = "";
					continue;
				}
				if (CLOUDFRONT_URL) {
					result[s3Key] = `${CLOUDFRONT_URL}/${s3Key}`;
				} else {
					const command = new GetObjectCommand({
						Bucket: BUCKET_NAME,
						Key: s3Key,
					});
					result[s3Key] = await getSignedUrl(s3Client, command, {
						expiresIn: 3600,
					});
				}
			}
			return result;
		}),
});
