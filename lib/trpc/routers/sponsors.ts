/**
 * tRPC router for Sponsors operations
 */

import { z } from "zod";
import { getActiveSponsors, sponsorsRepository } from "../../db/repositories";
import { sponsorSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const sponsorsRouter = router({
	/** Get all active sponsors */
	list: publicProcedure.query(async () => {
		return getActiveSponsors();
	}),

	/** Get sponsor by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const sponsor = await sponsorsRepository.get(input.id);
		if (!sponsor) {
			throw new Error("Sponsor not found");
		}
		return sponsor;
	}),

	/** Create sponsor (admin only) */
	create: protectedProcedure.input(sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		return sponsorsRepository.create({ ...input, id } as never);
	}),

	/** Update sponsor (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			return sponsorsRepository.update(input.id, input.data);
		}),

	/** Delete sponsor (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await sponsorsRepository.delete(input.id);
		return { success: true };
	}),
});
