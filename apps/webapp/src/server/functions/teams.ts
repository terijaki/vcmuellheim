/**
 * Teams server functions — replaces lib/trpc/routers/teams.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { teamSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { resolveNullableUpdates } from "./patch-helpers";

// ── Public ──────────────────────────────────────────────────────────────────

export const listTeamsFn = createServerFn().handler(async () => {
	const result = await db().team.query.byType({ type: "team" }).go({ pages: "all" });
	const items = parseServerArray(teamSchema, result.data, "Failed to parse team list");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getTeamBySlugFn = createServerFn()
	.inputValidator(z.object({ slug: z.string() }))
	.handler(async ({ data }) => {
		const result = await db().team.query.bySlug({ slug: data.slug }).go({ limit: 1 });
		const team = result.data[0] ? parseServerData(teamSchema, result.data[0], "Failed to parse team data") : null;
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
			data: teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true }).partial().extend({
				description: z.string().nullable().optional(),
				sbvvTeamId: z.string().nullable().optional(),
				ageGroup: z.string().nullable().optional(),
				league: z.string().nullable().optional(),
			}),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const { description, sbvvTeamId, ageGroup, league, name, ...restUpdates } = updates;
		const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
			description,
			sbvvTeamId,
			ageGroup,
			league,
		});

		const setFields = {
			...restUpdates,
			...nullableFields,
			...(name !== undefined ? { name, slug: slugify(name, true) } : {}),
			updatedAt: new Date().toISOString(),
		};

		const patchOp = db().team.patch({ id }).set(setFields);
		const result = await (removeKeys.length > 0 ? patchOp.remove(removeKeys) : patchOp).go();

		if (!result.data) throw new Error("Team not found");

		const refreshedResult = await db().team.get({ id }).go();
		const team = refreshedResult.data ? parseServerData(teamSchema, refreshedResult.data, "Failed to parse team data") : null;

		if (!team) throw new Error("Team not found");
		return team;
	});

export const deleteTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().team.delete({ id: data.id }).go();
		return { success: true };
	});
