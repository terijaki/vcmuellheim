/**
 * tRPC router for Events operations
 */

import { z } from "zod";
import { eventsRepository, getUpcomingEvents } from "../../db/repositories";
import { eventSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const eventsRouter = router({
	/** List all events (admin only) */
	list: protectedProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).optional().default(50),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			return eventsRepository.scan({ limit: input?.limit });
		}),

	/** Get upcoming events */
	upcoming: publicProcedure
		.input(
			z
				.object({
					limit: z.number().min(1).max(100).optional().default(20),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			return getUpcomingEvents(input?.limit);
		}),

	/** Get event by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const event = await eventsRepository.get(input.id);
		if (!event) {
			throw new Error("Event not found");
		}
		return event;
	}),

	/** Create event (admin only) */
	create: protectedProcedure.input(eventSchema.omit({ id: true, createdAt: true, updatedAt: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		return eventsRepository.create({ ...input, id } as never);
	}),

	/** Update event (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: eventSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			return eventsRepository.update(input.id, input.data);
		}),

	/** Delete event (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await eventsRepository.delete(input.id);
		return { success: true };
	}),
});
