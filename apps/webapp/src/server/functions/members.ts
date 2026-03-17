/**
 * Members server functions — replaces lib/trpc/routers/members.ts
 */

import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { memberSchema } from "@/lib/db/schemas";
import type { Member, Team } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const MEMBERS_TABLE_NAME = () => getTableName("MEMBERS");
const TEAMS_TABLE_NAME = () => getTableName("TEAMS");

// ── Public ──────────────────────────────────────────────────────────────────

export const listMembersFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: MEMBERS_TABLE_NAME(),
		}),
	);

	return {
		items: (result.Items as Member[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getBoardMembersFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: MEMBERS_TABLE_NAME(),
			FilterExpression: "isBoardMember = :isBoardMember",
			ExpressionAttributeValues: {
				":isBoardMember": true,
			},
		}),
	);

	return {
		items: (result.Items as Member[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getTrainersFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: MEMBERS_TABLE_NAME(),
			FilterExpression: "isTrainer = :isTrainer",
			ExpressionAttributeValues: {
				":isTrainer": true,
			},
		}),
	);

	return {
		items: (result.Items as Member[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getMemberByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: MEMBERS_TABLE_NAME(),
				Key: { id: data.id },
			}),
		);

		const member = result.Item as Member | undefined;
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

		await docClient.send(
			new PutCommand({
				TableName: MEMBERS_TABLE_NAME(),
				Item: member,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

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
		const { updateExpression, expressionAttributeNames, expressionAttributeValues } = buildUpdateExpression(updates);
		const result = await docClient.send(
			new UpdateCommand({
				TableName: MEMBERS_TABLE_NAME(),
				Key: { id },
				UpdateExpression: updateExpression,
				ExpressionAttributeNames: expressionAttributeNames,
				ExpressionAttributeValues: expressionAttributeValues,
				ConditionExpression: "attribute_exists(id)",
				ReturnValues: "ALL_NEW",
			}),
		);

		return result.Attributes as Member;
	});

export const deleteMemberFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		// Remove this member from all teams that reference them as a trainer
		const teamsResult = await docClient.send(
			new ScanCommand({
				TableName: TEAMS_TABLE_NAME(),
			}),
		);
		const teams = (teamsResult.Items as Team[]) || [];
		const teamsToUpdate = teams.filter((team) => team.trainerIds?.includes(data.id));
		for (const team of teamsToUpdate) {
			const updatedTrainerIds = team.trainerIds?.filter((id) => id !== data.id);
			const { updateExpression, expressionAttributeNames, expressionAttributeValues } = buildUpdateExpression({
				trainerIds: updatedTrainerIds,
			});

			await docClient.send(
				new UpdateCommand({
					TableName: TEAMS_TABLE_NAME(),
					Key: { id: team.id },
					UpdateExpression: updateExpression,
					ExpressionAttributeNames: expressionAttributeNames,
					ExpressionAttributeValues: expressionAttributeValues,
					ConditionExpression: "attribute_exists(id)",
				}),
			);
		}

		await docClient.send(
			new DeleteCommand({
				TableName: MEMBERS_TABLE_NAME(),
				Key: { id: data.id },
			}),
		);

		return { success: true };
	});
