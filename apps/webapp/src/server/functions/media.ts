/**
 * Media server functions — replaces lib/trpc/routers/media.ts
 */

import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { mediaSchema } from "@/lib/db/schemas";
import type { Media } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const TABLE_NAME = () => getTableName("MEDIA");

// ── Public ──────────────────────────────────────────────────────────────────

export const getMediaByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);

		const media = result.Item as Media | undefined;
		if (!media) throw new Error("Media not found");
		return media;
	});

export const getManyMediaFn = createServerFn()
	.inputValidator(z.object({ ids: z.array(z.uuid()) }))
	.handler(async ({ data }) => {
		if (data.ids.length === 0) {
			return [];
		}

		if (data.ids.length > 100) {
			throw new Error("Batch get supports max 100 items");
		}

		const results = await Promise.all(
			data.ids.map(async (id) => {
				const getResult = await docClient.send(
					new GetCommand({
						TableName: TABLE_NAME(),
						Key: { id },
					}),
				);

				return getResult.Item as Media | undefined;
			}),
		);

		return results.filter((media): media is Media => media !== undefined);
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const createMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const media = withTimestamps({
			...data,
			id: crypto.randomUUID(),
		});

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: media,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

		return media;
	});

export const updateMediaFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: mediaSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
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

		return result.Attributes as Media;
	});

export const deleteMediaFn = createServerFn()
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
