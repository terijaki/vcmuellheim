import { z } from "zod";
import { busRepository } from "../../db/repositories";
import { busSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const busRouter = router({
	/** List all bus bookings */
	list: publicProcedure.query(async () => {
		return busRepository.scan();
	}),

	/** Get bus booking by ID */
	getById: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
		const booking = await busRepository.get(input.id);
		if (!booking) throw new Error("Bus booking not found");
		return booking;
	}),

	/** Create bus booking (admin only) */
	create: protectedProcedure.input(busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		const now = new Date();
		const toDate = new Date(input.to);
		// TTL: 30 days after 'to' date
		const ttl = Math.floor((toDate.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000);
		return busRepository.create({
			...input,
			id,
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
			ttl,
		} as never);
	}),

	/** Update bus booking (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			const now = new Date();
			let ttl: number | undefined;
			if (input.data.to) {
				const toDate = new Date(input.data.to);
				ttl = Math.floor((toDate.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000);
			}
			return busRepository.update(input.id, { ...input.data, updatedAt: now.toISOString(), ...(ttl ? { ttl } : {}) });
		}),

	/** Delete bus booking (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
		await busRepository.delete(input.id);
		return { success: true };
	}),
});
