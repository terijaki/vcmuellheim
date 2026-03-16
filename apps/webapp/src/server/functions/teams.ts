/**
 * Teams server functions — replaces lib/trpc/routers/teams.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { getAllTeams, getTeamBySlug, teamSchema, teamsRepository } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const listTeamsFn = createServerFn().handler(async () => {
	return getAllTeams();
});

export const getTeamByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const team = await teamsRepository.get(data.id);
		if (!team) throw new Error("Team not found");
		return team;
	});

export const getTeamBySlugFn = createServerFn()
	.inputValidator(z.object({ slug: z.string() }))
	.handler(async ({ data }) => {
		const team = await getTeamBySlug(data.slug);
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
		return teamsRepository.create({ ...data, id, slug } as never);
	});

export const updateTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const finalUpdates = updates.name ? { ...updates, slug: slugify(updates.name, true) } : updates;
		return teamsRepository.update(id, finalUpdates);
	});

export const deleteTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		await teamsRepository.delete(data.id);
		return { success: true };
	});
