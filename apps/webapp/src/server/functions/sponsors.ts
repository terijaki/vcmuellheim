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
import { parseServerArray, parseServerData } from "../schema-parse";

// ── Public ──────────────────────────────────────────────────────────────────

export const listSponsorsFn = createServerFn().handler(async () => {
	const result = await db().sponsor.query.byType({ type: "sponsor" }).go({ pages: "all" });
	const items = parseServerArray(sponsorSchema, result.data, "Failed to parse sponsor list");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getSponsorByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().sponsor.get({ id: data.id }).go();
		const sponsor = result.data ? parseServerData(sponsorSchema, result.data, "Failed to parse sponsor data") : null;
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
			data: sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial().extend({
				logoS3Key: z.string().nullable().optional(),
				ttl: z.number().int().positive().nullable().optional(),
			}),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const existingResult = await db().sponsor.get({ id }).go();
		const existingSponsor = existingResult.data ? parseServerData(sponsorSchema, existingResult.data, "Failed to parse sponsor data") : null;
		const { logoS3Key, ttl, ...otherUpdates } = updates;

		if (!existingSponsor) throw new Error("Sponsor not found");

		const nextSponsor: Sponsor = {
			...existingSponsor,
			...otherUpdates,
			updatedAt: new Date().toISOString(),
		};

		if (logoS3Key !== undefined && logoS3Key !== null) {
			nextSponsor.logoS3Key = logoS3Key;
		}

		if (ttl !== undefined && ttl !== null) {
			nextSponsor.ttl = ttl;
		}

		if (logoS3Key === null) {
			delete nextSponsor.logoS3Key;
		}

		if (ttl === null) {
			delete nextSponsor.ttl;
		}

		const parsedSponsor = parseServerData(sponsorSchema, nextSponsor, "Failed to parse sponsor data");
		await db().sponsor.put(parsedSponsor).go();

		return parsedSponsor;
	});

export const deleteSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().sponsor.delete({ id: data.id }).go();
		return { success: true };
	});
