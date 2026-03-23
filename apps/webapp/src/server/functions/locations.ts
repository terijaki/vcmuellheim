/**
 * Locations server functions — replaces lib/trpc/routers/locations.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { locationSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

// ── Public ──────────────────────────────────────────────────────────────────

export const listLocationsFn = createServerFn().handler(async () => {
	const result = await db().location.query.byType({ type: "location" }).go({ pages: "all" });
	const items = parseServerArray(locationSchema, result.data, "Failed to parse location list");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getLocationByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().location.get({ id: data.id }).go();
		const location = result.data ? parseServerData(locationSchema, result.data, "Failed to parse location data") : null;
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

		if (!result.data) throw new Error("Location not found");

		const refreshedResult = await db().location.get({ id }).go();
		const location = refreshedResult.data ? parseServerData(locationSchema, refreshedResult.data, "Failed to parse location data") : null;

		if (!location) throw new Error("Location not found");
		return location;
	});

export const deleteLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().location.delete({ id: data.id }).go();
		return { success: true };
	});
