/**
 * Teams server functions — replaces lib/trpc/routers/teams.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { teamSchema } from "@/lib/db/schemas";
import type { Team } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";

// ── Public ──────────────────────────────────────────────────────────────────

export const listTeamsFn = createServerFn().handler(async () => {
	const result = await db().team.scan.go({ pages: "all" });

	return {
		items: result.data as Team[],
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getTeamByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().team.get({ id: data.id }).go();
		const team = result.data as Team | null;
		if (!team) throw new Error("Team not found");
		return team;
	});

export const getTeamBySlugFn = createServerFn()
	.inputValidator(z.object({ slug: z.string() }))
	.handler(async ({ data }) => {
		const result = await db().team.query.bySlug({ slug: data.slug }).go({ limit: 1 });
		const team = (result.data[0] as Team | undefined) ?? null;
		if (!team) throw new Error("Team not found");
		return team;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true }))
	.handler(async ({ data }) => {
		const id = crypto.randomUUID();
		const slug = slugify(data.name, true);
		const team = withTimestamps({
			...data,
			id,
			slug,
		});

		await db().team.create(team).go();

		return team;
	});

export const updateTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const finalUpdates = updates.name ? { ...updates, slug: slugify(updates.name, true) } : updates;
		const result = await db()
			.team.patch({ id })
			.set({ ...finalUpdates, updatedAt: new Date().toISOString() })
			.go();

		return result.data as Team;
	});

export const deleteTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().team.delete({ id: data.id }).go();
		return { success: true };
	});
