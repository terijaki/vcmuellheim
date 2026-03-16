/**
 * Members server functions — replaces lib/trpc/routers/members.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { getAllMembers, getAllTeams, getBoardMembers, getTrainers, memberSchema, membersRepository, teamsRepository } from "../db";

// ── Public ──────────────────────────────────────────────────────────────────

export const listMembersFn = createServerFn().handler(async () => {
	return getAllMembers();
});

export const getBoardMembersFn = createServerFn().handler(async () => {
	return getBoardMembers();
});

export const getTrainersFn = createServerFn().handler(async () => {
	return getTrainers();
});

export const getMemberByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		const member = await membersRepository.get(data.id);
		if (!member) throw new Error("Member not found");
		return member;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(memberSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		return membersRepository.create({ ...data, id: crypto.randomUUID() } as never);
	});

export const updateMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.string().uuid(),
			data: memberSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		return membersRepository.update(id, updates);
	});

export const deleteMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ data }) => {
		// Remove this member from all teams that reference them as a trainer
		const teams = await getAllTeams();
		const teamsToUpdate = teams.items.filter((team) => team.trainerIds?.includes(data.id));
		for (const team of teamsToUpdate) {
			const updatedTrainerIds = team.trainerIds?.filter((id) => id !== data.id);
			await teamsRepository.update(team.id, { trainerIds: updatedTrainerIds });
		}
		await membersRepository.delete(data.id);
		return { success: true };
	});
