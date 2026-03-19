/**
 * News server functions — replaces lib/trpc/routers/news.ts
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { newsSchema } from "@/lib/db/schemas";
import type { News } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";
import { getAllNews, getNewsBySlug, getPublishedNews } from "../queries";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = () => process.env.MEDIA_BUCKET_NAME || "";
const CLOUDFRONT_URL = () => process.env.CLOUDFRONT_URL || "";
const TABLE_NAME = () => getTableName("NEWS");
const cursorValueSchema = z.union([z.string(), z.number()]);
const cursorSchema = z.record(z.string(), cursorValueSchema);

// ── Public ──────────────────────────────────────────────────────────────────

export const getPublishedNewsFn = createServerFn()
	.inputValidator(
		z
			.object({
				limit: z.number().min(1).max(100).optional().default(10),
				cursor: cursorSchema.optional(),
			})
			.optional(),
	)
	.handler(async ({ data }) => {
		return getPublishedNews(data?.limit, data?.cursor);
	});

export const getNewsByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);

		const news = result.Item as News | undefined;
		if (!news) throw new Error("News article not found");
		return news;
	});

export const getNewsBySlugFn = createServerFn()
	.inputValidator(z.object({ slug: z.string() }))
	.handler(async ({ data }) => {
		const news = await getNewsBySlug(data.slug);
		if (!news) throw new Error("News article not found");
		return news;
	});

export const getGalleryImagesFn = createServerFn()
	.inputValidator(
		z
			.object({
				limit: z.number().min(1).max(100).optional().default(20),
				format: z.enum(["urls", "keys"]).optional().default("urls"),
				cursor: cursorSchema.optional(),
				shuffle: z.boolean().optional(),
			})
			.optional(),
	)
	.handler(async ({ data }) => {
		const { items, lastEvaluatedKey } = await getPublishedNews(data?.limit ?? 20, data?.cursor);

		const imageKeys: string[] = items.flatMap((article) => article.imageS3Keys ?? []).filter(Boolean);

		const shuffled = data?.shuffle ? [...imageKeys].sort(() => Math.random() - 0.5) : imageKeys;

		if (data?.format === "keys") {
			return { images: shuffled, nextCursor: lastEvaluatedKey };
		}

		const cloudfrontUrl = CLOUDFRONT_URL();
		const urls = await Promise.all(
			shuffled.map(async (key) => {
				if (cloudfrontUrl) return `${cloudfrontUrl}/${key}`;
				const cmd = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: key });
				return getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
			}),
		);

		return { images: urls, nextCursor: lastEvaluatedKey };
	});

// ── Protected (auth required) ────────────────────────────────────────────────

export const listAllNewsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z
			.object({
				limit: z.number().min(1).max(100).optional().default(30),
				lastEvaluatedKey: cursorSchema.optional(),
			})
			.optional(),
	)
	.handler(async ({ data }) => {
		return getAllNews(data?.limit, data?.lastEvaluatedKey);
	});

export const createNewsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(newsSchema.omit({ id: true, createdAt: true, updatedAt: true, type: true, slug: true }))
	.handler(async ({ data }) => {
		const id = crypto.randomUUID();
		const slug = slugify(data.title);
		const news = withTimestamps({ ...data, id, slug, type: "article" as const });

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: news,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

		return news;
	});

export const updateNewsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: newsSchema.omit({ id: true, createdAt: true, updatedAt: true, type: true, slug: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const baseUpdates = { ...updates, type: "article" as const };
		const finalUpdates = updates.title ? { ...baseUpdates, slug: slugify(updates.title) } : baseUpdates;

		const { updateExpression, expressionAttributeNames, expressionAttributeValues } = buildUpdateExpression(finalUpdates);

		const result = await docClient.send(
			new UpdateCommand({
				TableName: TABLE_NAME(),
				Key: { id },
				UpdateExpression: updateExpression,
				ExpressionAttributeNames: expressionAttributeNames,
				ExpressionAttributeValues: expressionAttributeValues,
				ConditionExpression: "attribute_exists(id)",
				ReturnValues: "ALL_NEW",
			}),
		);

		return result.Attributes as News;
	});

export const deleteNewsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await docClient.send(
			new DeleteCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		return { success: true };
	});
