/**
 * Locations server functions — replaces lib/trpc/routers/locations.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { locationSchema } from "@/lib/db/schemas";
import type { Location } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";

// ── Public ──────────────────────────────────────────────────────────────────

export const listLocationsFn = createServerFn().handler(async () => {
	const result = await db().location.scan.go({ pages: "all" });

	return {
		items: result.data as Location[],
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getLocationByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().location.get({ id: data.id }).go();
		const location = result.data as Location | null;
		if (!location) throw new Error("Location not found");
		return location;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(locationSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const location = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await db().location.create(location).go();

		return location;
	});

export const updateLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: locationSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const result = await db()
			.location.patch({ id })
			.set({ ...updates, updatedAt: new Date().toISOString() })
			.go();

		return result.data as Location;
	});

export const deleteLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().location.delete({ id: data.id }).go();
		return { success: true };
	});
