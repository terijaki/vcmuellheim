/**
 * tRPC router for News operations
 */

import { slugify } from "@utils/slugify";
import { z } from "zod";
import { getAllNews, getNewsBySlug, getPublishedNews, newsRepository } from "../../db/repositories";
import { newsSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const newsRouter = router({
	/** Get all news articles (admin only) */
	list: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).optional().default(30),
					lastEvaluatedKey: z.record(z.string(), z.unknown()).optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			return getAllNews(input?.limit, input?.lastEvaluatedKey);
		}),

	/** Get published news articles (public, cursor-based for infinite queries) */
	published: publicProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).optional().default(10),
					cursor: z.record(z.string(), z.unknown()).optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			return getPublishedNews(input?.limit, input?.cursor);
		}),

	/** Get news article by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const news = await newsRepository.get(input.id);
		if (!news) {
			throw new Error("News article not found");
		}
		return news;
	}),

	/** Get news article by slug */
	getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
		const news = await getNewsBySlug(input.slug);
		if (!news) {
			throw new Error("News article not found");
		}
		return news;
	}),

	/** Create news article (admin only) */
	create: protectedProcedure.input(newsSchema.omit({ id: true, createdAt: true, updatedAt: true, type: true, slug: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		const slug = slugify(input.title);
		return newsRepository.create({ ...input, id, slug, type: "article" });
	}),

	/** Update news article (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: newsSchema.omit({ id: true, createdAt: true, updatedAt: true, type: true, slug: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			const baseUpdates = { ...input.data, type: "article" as const };
			const updates = input.data.title ? { ...baseUpdates, slug: slugify(input.data.title) } : baseUpdates; // Update slug if title changes
			return newsRepository.update(input.id, updates);
		}),

	/** Delete news article (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await newsRepository.delete(input.id);
		return { success: true };
	}),

	/** Get all image S3 keys from published news articles (for photo gallery) */
	galleryImages: publicProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).optional().default(20),
					cursor: z.record(z.string(), z.unknown()).optional(),
					shuffle: z.boolean().optional().default(true),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			// Fetch published news articles
			const result = await getPublishedNews(input?.limit, input?.cursor);

			// Flatten all imageS3Keys from all articles
			const imageS3Keys: string[] = [];
			for (const article of result.items) {
				if (article.imageS3Keys && article.imageS3Keys.length > 0) {
					imageS3Keys.push(...article.imageS3Keys);
				}
			}

			// Shuffle if requested (default true)
			let finalKeys = imageS3Keys;
			if (input?.shuffle !== false) {
				// Fisher-Yates shuffle
				const shuffled = [...imageS3Keys];
				for (let i = shuffled.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
				}
				finalKeys = shuffled;
			}

			return {
				imageS3Keys: finalKeys,
				nextCursor: result.lastEvaluatedKey,
			};
		}),
});
