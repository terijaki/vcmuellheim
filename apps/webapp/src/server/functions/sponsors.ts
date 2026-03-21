/**
 * Sponsors server functions — replaces lib/trpc/routers/sponsors.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { sponsorSchema } from "@/lib/db/schemas";
import type { Sponsor } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";

// ── Public ──────────────────────────────────────────────────────────────────

export const listSponsorsFn = createServerFn().handler(async () => {
	const result = await db().sponsor.scan.go({ pages: "all" });

	return {
		items: result.data as Sponsor[],
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getSponsorByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().sponsor.get({ id: data.id }).go();
		const sponsor = result.data as Sponsor | null;
		if (!sponsor) throw new Error("Sponsor not found");
		return sponsor;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const sponsor = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await db().sponsor.create(sponsor).go();

		return sponsor;
	});

export const updateSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const result = await db()
			.sponsor.patch({ id })
			.set({ ...updates, updatedAt: new Date().toISOString() })
			.go();

		return result.data as Sponsor;
	});

export const deleteSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().sponsor.delete({ id: data.id }).go();
		return { success: true };
	});
