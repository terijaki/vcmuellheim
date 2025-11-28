/**
 * tRPC router for News operations
 */

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
					startKey: z.record(z.string(), z.unknown()).optional(),

				})
				.optional(),
		)
		.query(async ({ input }) => {
			return getAllNews(input?.limit, input?.startKey);
		}),

	/** Get published news articles (public) */
	published: publicProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).optional().default(10),
					startKey: z.record(z.string(), z.unknown()).optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			return getPublishedNews(input?.limit, input?.startKey);
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
	create: protectedProcedure.input(newsSchema.omit({ id: true, createdAt: true, updatedAt: true, type: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		return newsRepository.create({ ...input, id, type: "article" });
	}),

	/** Update news article (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: newsSchema.omit({ id: true, createdAt: true, updatedAt: true, type: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			return newsRepository.update(input.id, { ...input.data, type: "article" });
		}),

	/** Delete news article (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await newsRepository.delete(input.id);
		return { success: true };
	}),
});
