/**
 * Events server functions — replaces lib/trpc/routers/events.ts
 */

import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { eventSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import { resolveNullableUpdates } from "./patch-helpers";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

// ── Public ──────────────────────────────────────────────────────────────────

export const getUpcomingEventsFn = createServerFn()
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(20) }).optional())
	.handler(async ({ data }) => {
		const result = await db()
			.event.query.byType({ type: "event" })
			.gte({ startDate: dayjs().toISOString() })
			.go({ limit: data?.limit ?? 20 });
		const items = parseServerArray(eventSchema, result.data, "Failed to parse upcoming events");

		return {
			items,
			lastEvaluatedKey: result.cursor ?? undefined,
		};
	});

export const getEventByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().event.get({ id: data.id }).go();
		const event = result.data ? parseServerData(eventSchema, result.data, "Failed to parse event data") : null;
		return event;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const listAllEventsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.handler(async () => {
		const result = await db().event.query.byType({ type: "event" }).go({ pages: "all" });
		const items = parseServerArray(eventSchema, result.data, "Failed to parse event list");

		return {
			items,
			lastEvaluatedKey: result.cursor ?? undefined,
		};
	});

export const createEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(eventSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }))
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
			data: eventSchema
				.omit({ id: true, createdAt: true, updatedAt: true, ttl: true })
				.partial()
				.extend({
					description: z.string().nullable().optional(),
					location: z.string().nullable().optional(),
					variant: z.string().nullable().optional(),
				}),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const { description, location, variant, ...restUpdates } = updates;
		const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
			description,
			location,
			variant,
		});

		const setFields = {
			...restUpdates,
			...nullableFields,
			...(updates.endDate || updates.startDate
				? { ttl: dayjs(updates.endDate || updates.startDate).add(90, "day").unix() }
				: {}),
			updatedAt: new Date().toISOString(),
		};

		const patchOp = db().event.patch({ id }).set(setFields);
		const result = await (removeKeys.length > 0 ? patchOp.remove(removeKeys) : patchOp).go();

		if (!result.data) throw new Error("Event not found");

		const refreshedResult = await db().event.get({ id }).go();
		const event = refreshedResult.data ? parseServerData(eventSchema, refreshedResult.data, "Failed to parse event data") : null;

		if (!event) throw new Error("Event not found");
		return event;
	});

export const deleteEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().event.delete({ id: data.id }).go();
		return { success: true };
	});
