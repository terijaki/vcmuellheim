/**
 * tRPC router for Media operations
 */

import { z } from "zod";
import { mediaRepository } from "../../db/repositories";
import { mediaSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const mediaRouter = router({
	/** Get media by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const media = await mediaRepository.get(input.id);
		if (!media) {
			throw new Error("Media not found");
		}
		return media;
	}),

	/** Get multiple media items */
	getMany: publicProcedure.input(z.object({ ids: z.array(z.uuid()) })).query(async ({ input }) => {
		return mediaRepository.batchGet(input.ids);
	}),

	/** Create media record (admin only) */
	create: protectedProcedure.input(mediaSchema.omit({ id: true, createdAt: true, updatedAt: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		return mediaRepository.create({ ...input, id } as never);
	}),

	/** Update media record (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			return mediaRepository.update(input.id, input.data);
		}),

	/** Delete media record (admin only) - triggers S3 cleanup via DynamoDB Stream */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await mediaRepository.delete(input.id);
		return { success: true };
	}),
});
