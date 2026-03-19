/**
 * Events server functions — replaces lib/trpc/routers/events.ts
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { docClient, getTableName } from "@/lib/db/client";
import { eventSchema } from "@/lib/db/schemas";
import type { Event } from "@/lib/db/types";
import { requireAuthMiddleware } from "../../middleware";
import { buildUpdateExpression, withTimestamps } from "../dynamo";

const TABLE_NAME = () => getTableName("EVENTS");

// ── Public ──────────────────────────────────────────────────────────────────

export const getUpcomingEventsFn = createServerFn()
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(20) }).optional())
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new QueryCommand({
				TableName: TABLE_NAME(),
				IndexName: "GSI-EventQueries",
				KeyConditionExpression: "#type = :type AND #startDate >= :now",
				ExpressionAttributeNames: {
					"#type": "type",
					"#startDate": "startDate",
				},
				ExpressionAttributeValues: {
					":type": "event",
					":now": dayjs().toISOString(),
				},
				ScanIndexForward: true,
				Limit: data?.limit ?? 20,
			}),
		);

		return {
			items: (result.Items as Event[]) || [],
			lastEvaluatedKey: result.LastEvaluatedKey,
		};
	});

export const getEventByIdFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME(),
				Key: { id: data.id },
			}),
		);
		const event = result.Item as Event | undefined;
		if (!event) throw new Error("Event not found");
		return event;
	});

// ── Protected ────────────────────────────────────────────────────────────────

export const listAllEventsFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(z.object({ limit: z.number().min(1).max(100).optional().default(50) }).optional())
	.handler(async ({ data }) => {
		const result = await docClient.send(
			new ScanCommand({
				TableName: TABLE_NAME(),
				Limit: data?.limit,
			}),
		);

		return {
			items: (result.Items as Event[]) || [],
			lastEvaluatedKey: result.LastEvaluatedKey,
		};
	});

export const createEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(eventSchema.omit({ id: true, createdAt: true, updatedAt: true }))
	.handler(async ({ data }) => {
		const event = withTimestamps({
			...data,
			id: crypto.randomUUID(),
			ttl: dayjs(data.endDate || data.startDate)
				.add(90, "day")
				.unix(),
		});

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME(),
				Item: event,
				ConditionExpression: "attribute_not_exists(id)",
			}),
		);

		return event;
	});

export const updateEventFn = createServerFn()
	.middleware([requireAuthMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: eventSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		let ttl: number | undefined;
		if (updates.endDate || updates.startDate) {
			ttl = dayjs(updates.endDate || updates.startDate)
				.add(90, "day")
				.unix();
		}

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

		return result.Attributes as Event;
	});

export const deleteEventFn = createServerFn()
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
