/**
 * Media server functions — replaces lib/trpc/routers/media.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { mediaRepository, mediaSchema } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const getMediaByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const media = await mediaRepository.get(data.id);
		if (!media) throw new Error("Media not found");
		return media;
	});

export const getManyMediaFn = createServerFn()
	.inputValidator(z.object({ ids: z.array(z.string().uuid()) }))
	.handler(async ({ data }) => {
		return mediaRepository.batchGet(data.ids);
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		return mediaRepository.create({ ...data, id: crypto.randomUUID() } as never);
	});

export const updateMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		return mediaRepository.update(id, updates);
	});

export const deleteMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await mediaRepository.delete(data.id);
		return { success: true };
	});
