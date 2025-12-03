import { z } from "zod";
import { getAllLocations, locationsRepository } from "../../db/repositories";
import { locationSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const locationsRouter = router({
	/** Get all locations */
	list: publicProcedure.query(async () => {
		return getAllLocations();
	}),

	/** Get location by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const location = await locationsRepository.get(input.id);
		if (!location) {
			throw new Error("Location not found");
		}
		return location;
	}),

	/** Create location (admin only) */
	create: protectedProcedure.input(locationSchema.omit({ id: true, createdAt: true, updatedAt: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		return locationsRepository.create({ ...input, id } as never);
	}),

	/** Update location (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: locationSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			return locationsRepository.update(input.id, input.data);
		}),

	/** Delete location (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await locationsRepository.delete(input.id);
		return { success: true };
	}),
});
