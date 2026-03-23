/**
 * Bus server functions — replaces lib/trpc/routers/bus.ts
 */

import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { busSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

// ── Public ──────────────────────────────────────────────────────────────────

export const listBusFn = createServerFn().handler(async () => {
	const result = await db().bus.query.byType({ type: "bus" }).go({ pages: "all" });
	const items = parseServerArray(busSchema, result.data, "Failed to parse bus bookings");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getBusByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().bus.get({ id: data.id }).go();
		const booking = result.data ? parseServerData(busSchema, result.data, "Failed to parse bus booking") : null;
		if (!booking) throw new Error("Bus booking not found");
		return booking;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }))
	.handler(async ({ data }) => {
		const booking = withTimestamps({
			...data,
			id: crypto.randomUUID(),
			ttl: dayjs(data.to).add(30, "day").unix(),
		});

		await db().bus.create(booking).go();

		return booking;
	});

export const updateBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const ttl = updates.to ? dayjs(updates.to).add(30, "day").unix() : undefined;
		const result = await db()
			.bus.patch({ id })
			.set({
				...updates,
				...(ttl ? { ttl } : {}),
				updatedAt: new Date().toISOString(),
			})
			.go();

		if (!result.data) throw new Error("Bus booking not found");

		const refreshedResult = await db().bus.get({ id }).go();
		const booking = refreshedResult.data ? parseServerData(busSchema, refreshedResult.data, "Failed to parse bus booking") : null;

		if (!booking) throw new Error("Bus booking not found");
		return booking;
	});

export const deleteBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().bus.delete({ id: data.id }).go();
		return { success: true };
	});
