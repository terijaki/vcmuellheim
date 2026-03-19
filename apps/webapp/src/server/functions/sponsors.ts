/**
 * Sponsors server functions — replaces lib/trpc/routers/sponsors.ts
 */

import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { sponsorSchema } from "@/lib/db/schemas";
import type { Sponsor } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const TABLE_NAME = () => getTableName("SPONSORS");

// ── Public ──────────────────────────────────────────────────────────────────

export const listSponsorsFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: TABLE_NAME(),
		}),
	);

	return {
		items: (result.Items as Sponsor[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getSponsorByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		const sponsor = result.Item as Sponsor | undefined;
		if (!sponsor) throw new Error("Sponsor not found");
		return sponsor;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const sponsor = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: sponsor,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

		return sponsor;
	});

export const updateSponsorFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const { updateExpression, expressionAttributeNames, expressionAttributeValues } = buildUpdateExpression(updates);
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

		return result.Attributes as Sponsor;
	});

export const deleteSponsorFn = createServerFn()
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
