/**
 * tRPC router for Teams operations
 */

import { z } from "zod";
import { getActiveTeams, getTeamBySamsId, getTeamBySlug, teamsRepository } from "../../db/repositories";
import { teamSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const teamsRouter = router({
	/** Get all active teams */
	list: publicProcedure.query(async () => {
		return getActiveTeams();
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
			return teamsRepository.update(input.id, input.data);
		}),

	/** Delete team (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await teamsRepository.delete(input.id);
		return { success: true };
	}),
});
