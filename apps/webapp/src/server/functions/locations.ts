/**
 * Locations server functions — replaces lib/trpc/routers/locations.ts
 */

import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { locationSchema } from "@/lib/db/schemas";
import type { Location } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const TABLE_NAME = () => getTableName("LOCATIONS");

// ── Public ──────────────────────────────────────────────────────────────────

export const listLocationsFn = createServerFn().handler(async () => {
	const result = await docClient.send(
		new ScanCommand({
			TableName: TABLE_NAME(),
		}),
	);

	return {
		items: (result.Items as Location[]) || [],
		lastEvaluatedKey: result.LastEvaluatedKey,
	};
});

export const getLocationByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		const location = result.Item as Location | undefined;
		if (!location) throw new Error("Location not found");
		return location;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(locationSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const location = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: location,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

		return location;
	});

export const updateLocationFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: locationSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
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

		return result.Attributes as Location;
	});

export const deleteLocationFn = createServerFn()
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
