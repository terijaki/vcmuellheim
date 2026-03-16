/**
 * Sponsors server functions — replaces lib/trpc/routers/sponsors.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { getAllSponsors, sponsorSchema, sponsorsRepository } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const listSponsorsFn = createServerFn().handler(async () => {
	return getAllSponsors();
});

export const getSponsorByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const sponsor = await sponsorsRepository.get(data.id);
		if (!sponsor) throw new Error("Sponsor not found");
		return sponsor;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		return sponsorsRepository.create({ ...data, id: crypto.randomUUID() } as never);
	});

export const updateSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		return sponsorsRepository.update(id, updates);
	});

export const deleteSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await sponsorsRepository.delete(data.id);
		return { success: true };
	});
