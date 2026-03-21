/**
 * DynamoDB adapter for better-auth
 * Implements the CustomAdapter interface using the project's DynamoDB docClient
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createAdapterFactory } from "better-auth/adapters";
import { docClient } from "@/lib/db/client";
import { BetterAuthAdapterEnvironmentSchema } from "../content/types";
import { parseLambdaEnv } from "./env";

type AdapterWhere = Array<{ field: string; value: unknown; operator?: string; connector?: string }>;
type AdapterSortBy = { field: string; direction: "asc" | "desc" };
type AdapterJoin = { user?: boolean };
type AdapterFindManyArgs = {
	model: string;
	where?: AdapterWhere;
	limit?: number;
	select?: string[];
	sortBy?: AdapterSortBy;
	offset?: number;
	join?: AdapterJoin;
};

const env = parseLambdaEnv(BetterAuthAdapterEnvironmentSchema);

function shouldJoinUser(join: unknown): boolean {
	if (!join || typeof join !== "object") {
		return false;
	}

	return ("user" in join && (join as AdapterJoin).user === true) || false;
}

async function withSessionUserJoin(item: Record<string, unknown> | null, model: string, join: unknown): Promise<Record<string, unknown> | null> {
	if (!item) {
		return null;
	}

	if (model !== "session" || !shouldJoinUser(join)) {
		return item;
	}

	const userId = item.userId;
	if (typeof userId !== "string" || !userId) {
		return { ...item, user: null };
	}

	const userTableName = getTableNameForModel("user");
	const userResult = await docClient.send(
		new GetCommand({
			TableName: userTableName,
			Key: { id: userId },
		}),
	);

	return {
		...item,
		user: (userResult.Item as Record<string, unknown> | undefined) || null,
	};
}

/** Map better-auth model names to DynamoDB table environment variables */
function getTableNameForModel(_model: string): string {
	// All content entities live in the single content table
	const tableName = env.CONTENT_TABLE_NAME;
	if (!tableName) {
		throw new Error("CONTENT_TABLE_NAME is not configured");
	}
	return tableName;
}

/** Convert better-auth CleanedWhere to DynamoDB filter/key expressions */
function buildWhereExpression(where: AdapterWhere) {
	const expressionParts: string[] = [];
	const expressionAttributeNames: Record<string, string> = {};
	const expressionAttributeValues: Record<string, unknown> = {};

	for (let i = 0; i < where.length; i++) {
		const { field, value, operator = "eq" } = where[i];
		const attrName = `#w${i}`;
		const attrVal = `:w${i}`;
		expressionAttributeNames[attrName] = field;
		expressionAttributeValues[attrVal] = value;

		switch (operator) {
			case "eq":
				expressionParts.push(`${attrName} = ${attrVal}`);
				break;
			case "ne":
				expressionParts.push(`${attrName} <> ${attrVal}`);
				break;
			case "gt":
				expressionParts.push(`${attrName} > ${attrVal}`);
				break;
			case "gte":
				expressionParts.push(`${attrName} >= ${attrVal}`);
				break;
			case "lt":
				expressionParts.push(`${attrName} < ${attrVal}`);
				break;
			case "lte":
				expressionParts.push(`${attrName} <= ${attrVal}`);
				break;
			case "contains":
				expressionParts.push(`contains(${attrName}, ${attrVal})`);
				break;
			case "starts_with":
				expressionParts.push(`begins_with(${attrName}, ${attrVal})`);
				break;
			default:
				expressionParts.push(`${attrName} = ${attrVal}`);
		}
	}

	return {
		filterExpression: expressionParts.join(" AND "),
		expressionAttributeNames,
		expressionAttributeValues,
	};
}

function parseDateLike(value: unknown): number | null {
	if (value instanceof Date) {
		return value.getTime();
	}

	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}

	return null;
}

function compareValues(a: unknown, b: unknown): number {
	const aDate = parseDateLike(a);
	const bDate = parseDateLike(b);
	if (aDate !== null && bDate !== null) {
		return aDate - bDate;
	}

	if (typeof a === "number" && typeof b === "number") {
		return a - b;
	}

	if (typeof a === "boolean" && typeof b === "boolean") {
		if (a === b) return 0;
		return a ? 1 : -1;
	}

	const aString = String(a ?? "");
	const bString = String(b ?? "");
	return aString.localeCompare(bString);
}

function matchesWhere(item: Record<string, unknown>, where: AdapterWhere): boolean {
	for (const condition of where) {
		const operator = condition.operator ?? "eq";
		const itemValue = item[condition.field];
		const expected = condition.value;

		switch (operator) {
			case "eq": {
				const itemDate = parseDateLike(itemValue);
				const expectedDate = parseDateLike(expected);
				if (itemDate !== null && expectedDate !== null) {
					if (itemDate !== expectedDate) return false;
					break;
				}
				if (itemValue !== expected) return false;
				break;
			}
			case "ne": {
				const itemDate = parseDateLike(itemValue);
				const expectedDate = parseDateLike(expected);
				if (itemDate !== null && expectedDate !== null) {
					if (itemDate === expectedDate) return false;
					break;
				}
				if (itemValue === expected) return false;
				break;
			}
			case "gt":
				if (compareValues(itemValue, expected) <= 0) return false;
				break;
			case "gte":
				if (compareValues(itemValue, expected) < 0) return false;
				break;
			case "lt":
				if (compareValues(itemValue, expected) >= 0) return false;
				break;
			case "lte":
				if (compareValues(itemValue, expected) > 0) return false;
				break;
			case "contains": {
				if (typeof itemValue === "string" && typeof expected === "string") {
					if (!itemValue.includes(expected)) return false;
					break;
				}

				if (Array.isArray(itemValue)) {
					if (!itemValue.includes(expected)) return false;
					break;
				}

				return false;
			}
			case "starts_with": {
				if (typeof itemValue !== "string" || typeof expected !== "string") return false;
				if (!itemValue.startsWith(expected)) return false;
				break;
			}
			default:
				if (itemValue !== expected) return false;
		}
	}

	return true;
}

function sortItems(items: Record<string, unknown>[], sortBy?: AdapterSortBy) {
	if (!sortBy) {
		return items;
	}

	const sorted = [...items];
	sorted.sort((a, b) => {
		const comparison = compareValues(a[sortBy.field], b[sortBy.field]);
		return sortBy.direction === "asc" ? comparison : -comparison;
	});

	return sorted;
}

/** The GSI name for email-based lookups on the user model */
const USER_EMAIL_GSI = "GSI-UsersByEmail";
/** The GSI name for identifier-based lookups on the verification model */
const VERIFICATION_IDENTIFIER_GSI = "GSI-VerificationsByIdentifier";

export const dynamoDBAdapter = createAdapterFactory({
	config: {
		adapterId: "dynamodb",
		adapterName: "DynamoDB",
		supportsNumericIds: false,
		supportsUUIDs: true,
		supportsDates: false,
		usePlural: false,
		transaction: false,
	},
	adapter: ({ getModelName }) => {
		return {
			async create({ model, data }) {
				const tableName = getTableNameForModel(getModelName(model));

				// Add TTL for expiring auth records (verification/session).
				if ((model === "verification" || model === "session") && data.expiresAt) {
					const expiresAt = data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt as string);
					(data as Record<string, unknown>).ttl = Math.floor(expiresAt.getTime() / 1000);
				}

				await docClient.send(
					new PutCommand({
						TableName: tableName,
						Item: data,
					}),
				);
				return data as typeof data;
			},

			async findOne({ model, where, select, join }) {
				const tableName = getTableNameForModel(getModelName(model));

				// Optimize: use GSI for common lookup patterns
				const idWhere = where.find((w) => w.field === "id");
				if (idWhere) {
					const result = await docClient.send(
						new GetCommand({
							TableName: tableName,
							Key: { id: idWhere.value },
						}),
					);
					if (!result.Item) return null;
					if (select && select.length > 0) {
						const filtered: Record<string, unknown> = {};
						for (const key of select) {
							if (key in result.Item) filtered[key] = result.Item[key];
						}
						const withJoin = await withSessionUserJoin(filtered, model, join);
						return withJoin as ReturnType<typeof Object.assign>;
					}
					const withJoin = await withSessionUserJoin(result.Item as Record<string, unknown>, model, join);
					return withJoin as ReturnType<typeof Object.assign>;
				}

				// Use GSI for email lookups on user model
				const emailWhere = where.find((w) => w.field === "email");
				if (model === "user" && emailWhere) {
					const result = await docClient.send(
						new QueryCommand({
							TableName: tableName,
							IndexName: USER_EMAIL_GSI,
							KeyConditionExpression: "#email = :email",
							ExpressionAttributeNames: { "#email": "email" },
							ExpressionAttributeValues: { ":email": emailWhere.value },
							Limit: 1,
						}),
					);
					const first = (result.Items?.[0] as Record<string, unknown> | undefined) || null;
					const withJoin = await withSessionUserJoin(first, model, join);
					return withJoin as ReturnType<typeof Object.assign>;
				}

				// For verification records, always use the same deterministic lookup path as findMany.
				// better-auth expects the latest OTP by identifier.
				if (model === "verification") {
					const items = await this.findMany<Record<string, unknown>>({
						model,
						where,
						limit: 1,
						sortBy: { field: "createdAt", direction: "desc" },
					});

					const first = items[0];
					if (!first) return null;
					if (select && select.length > 0) {
						const filtered: Record<string, unknown> = {};
						for (const key of select) {
							if (key in first) filtered[key] = first[key];
						}
						const withJoin = await withSessionUserJoin(filtered, model, join);
						return withJoin as ReturnType<typeof Object.assign>;
					}

					const withJoin = await withSessionUserJoin(first, model, join);
					return withJoin as ReturnType<typeof Object.assign>;
				}

				// Fall back to scan with filter
				const { filterExpression, expressionAttributeNames, expressionAttributeValues } = buildWhereExpression(where);
				const result = await docClient.send(
					new ScanCommand({
						TableName: tableName,
						FilterExpression: filterExpression,
						ExpressionAttributeNames: expressionAttributeNames,
						ExpressionAttributeValues: expressionAttributeValues,
						Limit: 1,
					}),
				);
				const first = (result.Items?.[0] as Record<string, unknown> | undefined) || null;
				const withJoin = await withSessionUserJoin(first, model, join);
				return withJoin as ReturnType<typeof Object.assign>;
			},

			async findMany<T>({ model, where, limit = 100, sortBy, offset }: AdapterFindManyArgs): Promise<T[]> {
				const tableName = getTableNameForModel(getModelName(model));
				const startIndex = offset ?? 0;
				const targetCount = startIndex + limit;

				if (model === "verification" && where && where.length > 0) {
					const identifierWhere = where.find((w) => w.field === "identifier" && (w.operator === undefined || w.operator === "eq"));

					if (identifierWhere) {
						const queriedItems: Record<string, unknown>[] = [];
						let lastEvaluatedKey: Record<string, unknown> | undefined;

						do {
							const result = await docClient.send(
								new QueryCommand({
									TableName: tableName,
									IndexName: VERIFICATION_IDENTIFIER_GSI,
									KeyConditionExpression: "#identifier = :identifier",
									ExpressionAttributeNames: { "#identifier": "identifier" },
									ExpressionAttributeValues: { ":identifier": identifierWhere.value },
									ExclusiveStartKey: lastEvaluatedKey,
								}),
							);

							queriedItems.push(...((result.Items || []) as Record<string, unknown>[]));
							lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
						} while (lastEvaluatedKey);

						const filteredItems = queriedItems.filter((item) => matchesWhere(item, where));
						const sortedItems = sortItems(filteredItems, sortBy);
						return sortedItems.slice(startIndex, startIndex + limit) as T[];
					}
				}

				if (!where || where.length === 0) {
					const scannedItems: Record<string, unknown>[] = [];
					let lastEvaluatedKey: Record<string, unknown> | undefined;

					do {
						const result = await docClient.send(
							new ScanCommand({
								TableName: tableName,
								ExclusiveStartKey: lastEvaluatedKey,
								Limit: targetCount,
							}),
						);

						scannedItems.push(...((result.Items || []) as Record<string, unknown>[]));
						lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
					} while (lastEvaluatedKey && scannedItems.length < targetCount);

					const sortedItems = sortItems(scannedItems, sortBy);
					return sortedItems.slice(startIndex, startIndex + limit) as T[];
				}

				const { filterExpression, expressionAttributeNames, expressionAttributeValues } = buildWhereExpression(where);
				const scannedItems: Record<string, unknown>[] = [];
				let lastEvaluatedKey: Record<string, unknown> | undefined;

				do {
					const result = await docClient.send(
						new ScanCommand({
							TableName: tableName,
							FilterExpression: filterExpression,
							ExpressionAttributeNames: expressionAttributeNames,
							ExpressionAttributeValues: expressionAttributeValues,
							ExclusiveStartKey: lastEvaluatedKey,
							Limit: targetCount,
						}),
					);

					scannedItems.push(...((result.Items || []) as Record<string, unknown>[]));
					lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
				} while (lastEvaluatedKey && scannedItems.length < targetCount);

				const sortedItems = sortItems(scannedItems, sortBy);
				return sortedItems.slice(startIndex, startIndex + limit) as T[];
			},

			async update({ model, where, update }) {
				const tableName = getTableNameForModel(getModelName(model));

				// Find the current item so we preserve all existing fields on upsert-style updates.
				const existing = await this.findOne<Record<string, unknown>>({ model, where });
				if (!existing || !("id" in existing)) return null;

				const now = new Date().toISOString();
				const updatedItem: Record<string, unknown> = { ...existing, ...(update as Record<string, unknown>), updatedAt: now };

				if ((model === "verification" || model === "session") && "expiresAt" in updatedItem && updatedItem.expiresAt) {
					const expiresAt = updatedItem.expiresAt instanceof Date ? updatedItem.expiresAt : new Date(String(updatedItem.expiresAt));
					if (!Number.isNaN(expiresAt.getTime())) {
						updatedItem.ttl = Math.floor(expiresAt.getTime() / 1000);
					}
				}

				await docClient.send(
					new PutCommand({
						TableName: tableName,
						Item: updatedItem,
					}),
				);
				return updatedItem as ReturnType<typeof Object.assign>;
			},

			async updateMany({ model, where, update }) {
				const tableName = getTableNameForModel(getModelName(model));
				const items = await this.findMany<Record<string, unknown>>({ model, where, limit: 1000 });
				const now = new Date().toISOString();

				for (const item of items) {
					const updatedItem = { ...item, ...(update as Record<string, unknown>), updatedAt: now };
					await docClient.send(
						new PutCommand({
							TableName: tableName,
							Item: updatedItem,
						}),
					);
				}
				return items.length;
			},

			async delete({ model, where }) {
				const tableName = getTableNameForModel(getModelName(model));

				const idWhere = where.find((w) => w.field === "id");
				if (idWhere) {
					await docClient.send(
						new DeleteCommand({
							TableName: tableName,
							Key: { id: idWhere.value },
						}),
					);
					return;
				}

				// Find and delete by scanning
				const existing = await this.findOne<Record<string, unknown>>({ model, where, select: ["id"] });
				if (existing && "id" in existing && existing.id) {
					await docClient.send(
						new DeleteCommand({
							TableName: tableName,
							Key: { id: existing.id },
						}),
					);
				}
			},

			async deleteMany({ model, where }) {
				const tableName = getTableNameForModel(getModelName(model));
				const items = await this.findMany<Record<string, unknown>>({ model, where, limit: 1000 });

				for (const item of items) {
					if ("id" in item && item.id) {
						await docClient.send(
							new DeleteCommand({
								TableName: tableName,
								Key: { id: item.id },
							}),
						);
					}
				}
				return items.length;
			},

			async count({ model, where }) {
				const tableName = getTableNameForModel(getModelName(model));

				if (!where || where.length === 0) {
					const result = await docClient.send(
						new ScanCommand({
							TableName: tableName,
							Select: "COUNT",
						}),
					);
					return result.Count || 0;
				}

				const { filterExpression, expressionAttributeNames, expressionAttributeValues } = buildWhereExpression(where);
				const result = await docClient.send(
					new ScanCommand({
						TableName: tableName,
						FilterExpression: filterExpression,
						ExpressionAttributeNames: expressionAttributeNames,
						ExpressionAttributeValues: expressionAttributeValues,
						Select: "COUNT",
					}),
				);
				return result.Count || 0;
			},
		};
	},
});
