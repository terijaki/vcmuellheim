/**
 * Members server functions — replaces lib/trpc/routers/members.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { memberSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

// ── Public ──────────────────────────────────────────────────────────────────

export const listMembersFn = createServerFn().handler(async () => {
	const result = await db().member.query.byType({ type: "member" }).go({ pages: "all" });
	const items = parseServerArray(memberSchema, result.data, "Failed to parse member list");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getBoardMembersFn = createServerFn().handler(async () => {
	const result = await db()
		.member.query.byType({ type: "member" })
		.where((attr, op) => op.eq(attr.isBoardMember, true))
		.go({ pages: "all" });
	const items = parseServerArray(memberSchema, result.data, "Failed to parse board member list");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getTrainersFn = createServerFn().handler(async () => {
	const result = await db()
		.member.query.byType({ type: "member" })
		.where((attr, op) => op.eq(attr.isTrainer, true))
		.go({ pages: "all" });
	const items = parseServerArray(memberSchema, result.data, "Failed to parse trainer list");

	return {
		items,
		lastEvaluatedKey: result.cursor ?? undefined,
	};
});

export const getMemberByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().member.get({ id: data.id }).go();

		const member = result.data ? parseServerData(memberSchema, result.data, "Failed to parse member data") : null;
		if (!member) throw new Error("Member not found");
		return member;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(memberSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const member = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await db().member.create(member).go();

		return member;
	});

export const updateMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: memberSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const result = await db()
			.member.patch({ id })
			.set({ ...updates, updatedAt: new Date().toISOString() })
			.go();

		if (!result.data) throw new Error("Member not found");

		const refreshedResult = await db().member.get({ id }).go();
		const member = refreshedResult.data ? parseServerData(memberSchema, refreshedResult.data, "Failed to parse member data") : null;

		if (!member) throw new Error("Member not found");
		return member;
	});

export const deleteMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		// Remove this member from all teams that reference them as a trainer
		const teamsResult = await db().team.query.byType({ type: "team" }).go({ pages: "all" });
		const teams = teamsResult.data;
		const teamsToUpdate = teams.filter((team) => team.trainerIds?.includes(data.id));
		for (const team of teamsToUpdate) {
			const updatedTrainerIds = team.trainerIds?.filter((id) => id !== data.id);
			await db().team.patch({ id: team.id }).set({ trainerIds: updatedTrainerIds, updatedAt: new Date().toISOString() }).go();
		}

		await db().member.delete({ id: data.id }).go();

		return { success: true };
	});
