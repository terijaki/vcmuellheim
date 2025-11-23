/**
 * tRPC router for file upload operations
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = process.env.MEDIA_BUCKET_NAME || "";

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
			const key = `${input.folder}/${Date.now()}-${input.filename}`;

			const command = new PutObjectCommand({
				Bucket: BUCKET_NAME,
				Key: key,
				ContentType: input.contentType,
			});

			const presignedUrl = await getSignedUrl(s3Client, command, {
				expiresIn: 300, // 5 minutes
			});

			return {
				uploadUrl: presignedUrl,
				key,
				bucket: BUCKET_NAME,
			};
		}),

	/** Generate presigned URL for viewing/downloading a file */
	getFileUrl: publicProcedure
		.input(
			z.object({
				s3Key: z.string(),
			}),
		)
		.query(async ({ input }) => {
			if (!input.s3Key) {
				return null;
			}

			const command = new GetObjectCommand({
				Bucket: BUCKET_NAME,
				Key: input.s3Key,
			});

			const presignedUrl = await getSignedUrl(s3Client, command, {
				expiresIn: 3600, // 1 hour
			});

			return presignedUrl;
		}),
});
