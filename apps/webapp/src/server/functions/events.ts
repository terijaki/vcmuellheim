/**
 * Events server functions — replaces lib/trpc/routers/events.ts
 */

import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { eventSchema } from "@/lib/db/schemas";
import type { Event } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";

// ── Public ──────────────────────────────────────────────────────────────────

export const getUpcomingEventsFn = createServerFn()
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(20) }).optional())
	.handler(async ({ data }) => {
		const result = await db()
			.event.query.byType({ type: "event" })
			.gte({ startDate: dayjs().toISOString() })
			.go({ limit: data?.limit ?? 20 });

		return {
			items: result.data as Event[],
			lastEvaluatedKey: result.cursor ?? undefined,
		};
	});

export const getEventByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().event.get({ id: data.id }).go();
		const event = result.data as Event | null;
		if (!event) throw new Error("Event not found");
		return event;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const listAllEventsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(50) }).optional())
	.handler(async () => {
		const result = await db().event.scan.go({ pages: "all" });

		return {
			items: result.data as Event[],
			lastEvaluatedKey: result.cursor ?? undefined,
		};
	});

export const createEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(eventSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const event = withTimestamps({
			...data,
			id: crypto.randomUUID(),
			ttl: dayjs(data.endDate || data.startDate)
				.add(90, "day")
				.unix(),
		});

		await db().event.create(event).go();

		return event;
	});

export const updateEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
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

		const result = await db()
			.event.patch({ id })
			.set({
				...updates,
				...(ttl ? { ttl } : {}),
				updatedAt: new Date().toISOString(),
			})
			.go();

		return result.data as Event;
	});

export const deleteEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().event.delete({ id: data.id }).go();
		return { success: true };
	});
