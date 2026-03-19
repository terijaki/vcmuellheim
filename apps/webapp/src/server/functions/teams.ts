/**
 * Teams server functions — replaces lib/trpc/routers/teams.ts
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { teamSchema } from "@/lib/db/schemas";
import type { Team } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const TABLE_NAME = () => getTableName("TEAMS");

// ── Public ──────────────────────────────────────────────────────────────────

export const listTeamsFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: TABLE_NAME(),
		}),
	);

	return {
		items: (result.Items as Team[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getTeamByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		const team = result.Item as Team | undefined;
		if (!team) throw new Error("Team not found");
		return team;
	});

export const getTeamBySlugFn = createServerFn()
	.inputValidator(z.object({ slug: z.string() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new QueryCommand({
				TableName: TABLE_NAME(),
				IndexName: "GSI-TeamQueries",
				KeyConditionExpression: "#type = :type AND #slug = :slug",
				ExpressionAttributeNames: {
					"#type": "type",
					"#slug": "slug",
				},
				ExpressionAttributeValues: {
					":type": "team",
					":slug": data.slug,
				},
				Limit: 1,
			}),
		);
		const team = (result.Items?.[0] as Team | undefined) ?? null;
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

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: team,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

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
		const { updateExpression, expressionAttributeNames, expressionAttributeValues } = buildUpdateExpression(finalUpdates);
		const result = await docClient.send(
			new UpdateCommand({
				TableName: TABLE_NAME(),
				Key: { id },
				UpdateExpression: updateExpression,
				ExpressionAttributeNames: expressionAttributeNames,
				ExpressionAttributeValues: expressionAttributeValues,
				ConditionExpression: "attribute_exists(id)",
				ReturnValues: "ALL_NEW",
			}),
		);

		return result.Attributes as Team;
	});

export const deleteTeamFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await docClient.send(
			new DeleteCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		return { success: true };
	});
