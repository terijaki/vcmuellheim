/**
 * tRPC router for Teams operations
 */

import { z } from "zod";
import { getAllTeams, getTeamBySamsId, getTeamBySlug, teamsRepository } from "../../db/repositories";
import { teamSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const teamsRouter = router({
	/** Get all teams (for admin) */
	list: publicProcedure.query(async () => {
		return getAllTeams();
	}),

	/** Get team by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const team = await teamsRepository.get(input.id);
		if (!team) {
			throw new Error("Team not found");
		}
		return team;
	}),

	/** Get team by slug */
	getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
		const team = await getTeamBySlug(input.slug);
		if (!team) {
			throw new Error("Team not found");
		}
		return team;
	}),

	/** Get team by SAMS/SBVV team ID */
	getBySamsId: publicProcedure.input(z.object({ sbvvTeamId: z.string() })).query(async ({ input }) => {
		const team = await getTeamBySamsId(input.sbvvTeamId);
		if (!team) {
			throw new Error("Team not found");
		}
		return team;
	}),

	/** Create team (admin only) */
	create: protectedProcedure.input(teamSchema.omit({ id: true, createdAt: true, updatedAt: true })).mutation(async ({ input }) => {
		// Check if team with this slug already exists
		const existingTeam = await getTeamBySlug(input.slug);
		if (existingTeam) {
			throw new Error("Eine Mannschaft mit diesem Namen existiert bereits");
		}

		const id = crypto.randomUUID();
		return teamsRepository.create({ ...input, id } as never);
	}),

	/** Update team (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: teamSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			// If updating slug, check it's not already used by another team
			if (input.data.slug) {
				const existingTeam = await getTeamBySlug(input.data.slug);
				if (existingTeam && existingTeam.id !== input.id) {
					throw new Error("Eine Mannschaft mit diesem Namen existiert bereits");
				}
			}

			return teamsRepository.update(input.id, input.data);
		}),

	/** Delete team (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await teamsRepository.delete(input.id);
		return { success: true };
	}),
});
