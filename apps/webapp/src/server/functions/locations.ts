/**
 * Locations server functions — replaces lib/trpc/routers/locations.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { getAllLocations, locationSchema, locationsRepository } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const listLocationsFn = createServerFn().handler(async () => {
	return getAllLocations();
});

export const getLocationByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const location = await locationsRepository.get(data.id);
		if (!location) throw new Error("Location not found");
		return location;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(locationSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		return locationsRepository.create({ ...data, id: crypto.randomUUID() } as never);
	});

export const updateLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: locationSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		return locationsRepository.update(id, updates);
	});

export const deleteLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await locationsRepository.delete(data.id);
		return { success: true };
	});
