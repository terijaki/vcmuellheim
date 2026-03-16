/**
 * Events server functions — replaces lib/trpc/routers/events.ts
 */

import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { eventSchema, eventsRepository, getUpcomingEvents } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const getUpcomingEventsFn = createServerFn()
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(20) }).optional())
	.handler(async ({ data }) => {
		return getUpcomingEvents(data?.limit);
	});

export const getEventByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const event = await eventsRepository.get(data.id);
		if (!event) throw new Error("Event not found");
		return event;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const listAllEventsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(50) }).optional())
	.handler(async ({ data }) => {
		return eventsRepository.scan({ limit: data?.limit });
	});

export const createEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(eventSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		return eventsRepository.create({
			...data,
			id: crypto.randomUUID(),
			ttl: dayjs(data.endDate || data.startDate)
				.add(90, "day")
				.unix(),
		} as never);
	});

export const updateEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: eventSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		let ttl: number | undefined;
		if (updates.endDate || updates.startDate) {
			ttl = dayjs(updates.endDate || updates.startDate)
				.add(90, "day")
				.unix();
		}
		return eventsRepository.update(id, { ...updates, ...(ttl ? { ttl } : {}) });
	});

export const deleteEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await eventsRepository.delete(data.id);
		return { success: true };
	});
