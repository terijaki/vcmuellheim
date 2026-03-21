/**
 * News server functions — replaces lib/trpc/routers/news.ts
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { newsSchema } from "@/lib/db/schemas";
import type { News } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { getAllNews, getNewsBySlug, getPublishedNews } from "../queries";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = () => process.env.MEDIA_BUCKET_NAME || "";
const CLOUDFRONT_URL = () => process.env.CLOUDFRONT_URL || "";
const cursorSchema = z.string();

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
		const result = await db().news.get({ id: data.id }).go();
		const news = result.data as News | null;
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

		await db().news.create(news).go();

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
		const baseUpdates = { ...updates, type: "article" as const, updatedAt: new Date().toISOString() };
		const finalUpdates = updates.title ? { ...baseUpdates, slug: slugify(updates.title) } : baseUpdates;

		const result = await db().news.patch({ id }).set(finalUpdates).go();
		return result.data as News;
	});

export const deleteNewsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().news.delete({ id: data.id }).go();
		return { success: true };
	});
