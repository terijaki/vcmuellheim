/**
 * Bus server functions — replaces lib/trpc/routers/bus.ts
 */

import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { busRepository, busSchema } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const listBusFn = createServerFn().handler(async () => {
	return busRepository.scan();
});

export const getBusByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const booking = await busRepository.get(data.id);
		if (!booking) throw new Error("Bus booking not found");
		return booking;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }))
	.handler(async ({ data }) => {
		return busRepository.create({
			...data,
			id: crypto.randomUUID(),
			createdAt: dayjs().toISOString(),
			updatedAt: dayjs().toISOString(),
			ttl: dayjs(data.to).add(30, "day").unix(),
		} as never);
	});

export const updateBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const ttl = updates.to ? dayjs(updates.to).add(30, "day").unix() : undefined;
		return busRepository.update(id, { ...updates, ...(ttl ? { ttl } : {}) });
	});

export const deleteBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await busRepository.delete(data.id);
		return { success: true };
	});
