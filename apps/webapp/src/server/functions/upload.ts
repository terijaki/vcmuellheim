/**
 * Upload server functions — replaces lib/trpc/routers/upload.ts
 */

import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = () => process.env.MEDIA_BUCKET_NAME || "";
const CLOUDFRONT_URL = () => process.env.CLOUDFRONT_URL || "";

// ── Public ──────────────────────────────────────────────────────────────────

export const getFileUrlFn = createServerFn()
	.inputValidator(z.object({ s3Key: z.string() }))
	.handler(async ({ data }): Promise<string | null> => {
		if (!data.s3Key) return null;
		const cfUrl = CLOUDFRONT_URL();
		if (cfUrl) return `${cfUrl}/${data.s3Key}`;
		const command = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: data.s3Key });
		return getSignedUrl(s3Client, command, { expiresIn: 3600 });
	});

export const getFileUrlsFn = createServerFn()
	.inputValidator(z.object({ s3Keys: z.array(z.string()).optional().default([]) }))
	.handler(async ({ data }): Promise<string[]> => {
		const result: string[] = [];
		const cfUrl = CLOUDFRONT_URL();
		for (const s3Key of data.s3Keys) {
			if (cfUrl) {
				result.push(`${cfUrl}/${s3Key}`);
			} else {
				const command = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: s3Key });
				result.push(await getSignedUrl(s3Client, command, { expiresIn: 3600 }));
			}
		}
		return result;
	});

export const getFileUrlsMapFn = createServerFn()
	.inputValidator(z.object({ s3Keys: z.array(z.string()).optional().default([]) }))
	.handler(async ({ data }): Promise<Record<string, string>> => {
		const result: Record<string, string> = {};
		const cfUrl = CLOUDFRONT_URL();
		for (const s3Key of data.s3Keys) {
			if (!s3Key) {
				result[s3Key] = "";
				continue;
			}
			if (cfUrl) {
				result[s3Key] = `${cfUrl}/${s3Key}`;
			} else {
				const command = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: s3Key });
				result[s3Key] = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
			}
		}
		return result;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const getPresignedUrlFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			filename: z.string(),
			contentType: z.string(),
			folder: z.enum(["sponsors", "teams", "members", "news", "media"]).default("media"),
		}),
	)
	.handler(async ({ data }) => {
		const fileExtension = data.filename.split(".").pop() || "";
		const sanitizedExtension = fileExtension.toLowerCase().replace(/[^a-z0-9]/g, "");
		const uuid = randomUUID();
		const finalKey = sanitizedExtension ? `${data.folder}/${uuid}.${sanitizedExtension}` : `${data.folder}/${uuid}`;
		const isSvg = sanitizedExtension === "svg";
		const uploadKey = isSvg ? finalKey : sanitizedExtension ? `uploads/${data.folder}/${uuid}.${sanitizedExtension}` : `uploads/${data.folder}/${uuid}`;

		const command = new PutObjectCommand({
			Bucket: BUCKET_NAME(),
			Key: uploadKey,
			ContentType: data.contentType,
		});

		const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

		return {
			uploadUrl: presignedUrl,
			key: finalKey,
			bucket: BUCKET_NAME(),
		};
	});
