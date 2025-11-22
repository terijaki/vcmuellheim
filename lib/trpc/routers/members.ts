/**
 * tRPC router for Members operations
 */

import { z } from "zod";
import { getAllMembers, getBoardMembers, getTrainers, membersRepository } from "../../db/repositories";
import { memberSchema } from "../../db/schemas";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const membersRouter = router({
	/** Get all members */
	list: publicProcedure.query(async () => {
		return getAllMembers();
	}),

	/** Get board members (Vorstand) */
	board: publicProcedure.query(async () => {
		return getBoardMembers();
	}),

	/** Get trainers */
	trainers: publicProcedure.query(async () => {
		return getTrainers();
	}),

	/** Get member by ID */
	getById: publicProcedure.input(z.object({ id: z.uuid() })).query(async ({ input }) => {
		const member = await membersRepository.get(input.id);
		if (!member) {
			throw new Error("Member not found");
		}
		return member;
	}),

	/** Create member (admin only) */
	create: protectedProcedure.input(memberSchema.omit({ id: true, createdAt: true, updatedAt: true })).mutation(async ({ input }) => {
		const id = crypto.randomUUID();
		return membersRepository.create({ ...input, id } as never);
	}),

	/** Update member (admin only) */
	update: protectedProcedure
		.input(
			z.object({
				id: z.uuid(),
				data: memberSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
			}),
		)
		.mutation(async ({ input }) => {
			return membersRepository.update(input.id, input.data);
		}),

	/** Delete member (admin only) */
	delete: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ input }) => {
		await membersRepository.delete(input.id);
		return { success: true };
	}),
});
