/**
 * DynamoDB adapter for better-auth
 * Implements the CustomAdapter interface using the project's DynamoDB docClient
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { createAdapterFactory } from "better-auth/adapters";
import { docClient } from "@/lib/db/client";

/** Map better-auth model names to DynamoDB table environment variables */
function getTableNameForModel(model: string): string {
	const modelTableMap: Record<string, string> = {
		user: process.env.USERS_TABLE_NAME || "",
		verification: process.env.AUTH_VERIFICATIONS_TABLE_NAME || "",
	};

	const tableName = modelTableMap[model];
	if (!tableName) {
		throw new Error(`Unknown model: ${model}. Supported models: ${Object.keys(modelTableMap).join(", ")}`);
	}
	return tableName;
}

/** Convert better-auth CleanedWhere to DynamoDB filter/key expressions */
function buildWhereExpression(where: Array<{ field: string; value: unknown; operator?: string; connector?: string }>) {
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
		usePlural: false,
		transaction: false,
	},
	adapter: ({ getModelName }) => {
		return {
			async create({ model, data }) {
				const tableName = getTableNameForModel(getModelName(model));

				// Add TTL for verification records (OTP codes expire after 10 minutes)
				if (model === "verification" && data.expiresAt) {
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

			async findOne({ model, where, select }) {
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
						return filtered as ReturnType<typeof Object.assign>;
					}
					return result.Item as ReturnType<typeof Object.assign>;
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
					return (result.Items?.[0] as ReturnType<typeof Object.assign>) || null;
				}

				// Use GSI for identifier lookups on verification model
				const identifierWhere = where.find((w) => w.field === "identifier");
				if (model === "verification" && identifierWhere) {
					const result = await docClient.send(
						new QueryCommand({
							TableName: tableName,
							IndexName: VERIFICATION_IDENTIFIER_GSI,
							KeyConditionExpression: "#identifier = :identifier",
							ExpressionAttributeNames: { "#identifier": "identifier" },
							ExpressionAttributeValues: { ":identifier": identifierWhere.value },
							Limit: 1,
						}),
					);
					return (result.Items?.[0] as ReturnType<typeof Object.assign>) || null;
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
				return (result.Items?.[0] as ReturnType<typeof Object.assign>) || null;
			},

			async findMany({ model, where, limit = 100, sortBy, offset }) {
				const tableName = getTableNameForModel(getModelName(model));

				if (!where || where.length === 0) {
					const result = await docClient.send(
						new ScanCommand({
							TableName: tableName,
							Limit: limit,
						}),
					);
					let items = (result.Items || []) as ReturnType<typeof Object.assign>[];
					if (sortBy) {
						items.sort((a, b) => {
							const aVal = a[sortBy.field];
							const bVal = b[sortBy.field];
							if (aVal < bVal) return sortBy.direction === "asc" ? -1 : 1;
							if (aVal > bVal) return sortBy.direction === "asc" ? 1 : -1;
							return 0;
						});
					}
					if (offset) items = items.slice(offset);
					return items;
				}

				const { filterExpression, expressionAttributeNames, expressionAttributeValues } = buildWhereExpression(where);
				const result = await docClient.send(
					new ScanCommand({
						TableName: tableName,
						FilterExpression: filterExpression,
						ExpressionAttributeNames: expressionAttributeNames,
						ExpressionAttributeValues: expressionAttributeValues,
						Limit: limit,
					}),
				);
				let items = (result.Items || []) as ReturnType<typeof Object.assign>[];
				if (offset) items = items.slice(offset);
				return items;
			},

			async update({ model, where, update }) {
				const tableName = getTableNameForModel(getModelName(model));

				// Find the item first to get its id
				const existing = await this.findOne<Record<string, unknown>>({ model, where, select: ["id"] });
				if (!existing || !("id" in existing)) return null;

				const now = new Date().toISOString();
				const updatedItem = { ...existing, ...(update as Record<string, unknown>), updatedAt: now };

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
