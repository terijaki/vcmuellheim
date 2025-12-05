import { slugify } from "@utils/slugify";
import { z } from "zod";
import { getAllTeams, getTeamBySlug, teamsRepository } from "../../db/repositories";
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

	/** Create team (admin only) */
	create: protectedProcedure.input(teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		const slug = slugify(input.name);
		return teamsRepository.create({ ...input, id, slug } as never);
	}),

	/** Update team (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			// Build updates with slug regeneration if name changes
			const baseUpdates = { ...input.data };
			const updates = input.data.name ? { ...baseUpdates, slug: slugify(input.data.name) } : baseUpdates;
			return teamsRepository.update(input.id, updates);
		}),

	/** Delete team (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await teamsRepository.delete(input.id);
		return { success: true };
	}),
});
