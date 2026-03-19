/**
 * Bus server functions — replaces lib/trpc/routers/bus.ts
 */

import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { busSchema } from "@/lib/db/schemas";
import type { Bus } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const TABLE_NAME = () => getTableName("BUS");

// ── Public ──────────────────────────────────────────────────────────────────

export const listBusFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: TABLE_NAME(),
		}),
	);

	return {
		items: (result.Items as Bus[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getBusByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		const booking = result.Item as Bus | undefined;
		if (!booking) throw new Error("Bus booking not found");
		return booking;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }))
	.handler(async ({ data }) => {
		const booking = withTimestamps({
			...data,
			id: crypto.randomUUID(),
			ttl: dayjs(data.to).add(30, "day").unix(),
		});

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: booking,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

		return booking;
	});

export const updateBusFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const ttl = updates.to ? dayjs(updates.to).add(30, "day").unix() : undefined;
		const { updateExpression, expressionAttributeNames, expressionAttributeValues } = buildUpdateExpression({
			...updates,
			...(ttl ? { ttl } : {}),
		});

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

		return result.Attributes as Bus;
	});

export const deleteBusFn = createServerFn()
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
