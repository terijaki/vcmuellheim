/**
 * Media server functions — replaces lib/trpc/routers/media.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { mediaSchema } from "@/lib/db/schemas";
import type { Media } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerData } from "../schema-parse";

// ── Public ──────────────────────────────────────────────────────────────────

export const getMediaByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().media.get({ id: data.id }).go();

		const media = result.data ? parseServerData(mediaSchema, result.data, "Failed to parse media data") : null;
		if (!media) throw new Error("Media not found");
		return media;
	});

export const getManyMediaFn = createServerFn()
	.inputValidator(z.object({ ids: z.array(z.uuid()) }))
	.handler(async ({ data }) => {
		if (data.ids.length === 0) {
			return [];
		}

		if (data.ids.length > 100) {
			throw new Error("Batch get supports max 100 items");
		}

		const results = await Promise.all(
			data.ids.map(async (id) => {
				const getResult = await db().media.get({ id }).go();
				return getResult.data ? parseServerData(mediaSchema, getResult.data, "Failed to parse media data") : null;
			}),
		);

		return results.filter((media): media is Media => media !== null);
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const media = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await db().media.create(media).go();

		return media;
	});

export const updateMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const result = await db()
			.media.patch({ id })
			.set({ ...updates, updatedAt: new Date().toISOString() })
			.go();

		if (!result.data) throw new Error("Media not found");

		const refreshedResult = await db().media.get({ id }).go();
		const media = refreshedResult.data ? parseServerData(mediaSchema, refreshedResult.data, "Failed to parse media data") : null;

		if (!media) throw new Error("Media not found");
		return media;
	});

export const deleteMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().media.delete({ id: data.id }).go();
		return { success: true };
	});
