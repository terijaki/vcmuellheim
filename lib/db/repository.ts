/**
 * Generic DynamoDB repository with CRUD operations
 */

import type { QueryCommandInput, ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import type { BaseEntity } from "./types";

export interface RepositoryConfig {
	tableName: string;
}

export interface QueryOptions {
	indexName?: string;
	keyConditionExpression: string;
	expressionAttributeValues: Record<string, unknown>;
	expressionAttributeNames?: Record<string, string>;
	filterExpression?: string;
	scanIndexForward?: boolean;
	limit?: number;
	exclusiveStartKey?: Record<string, unknown>;
}

export interface ScanOptions {
	filterExpression?: string;
	expressionAttributeValues?: Record<string, unknown>;
	expressionAttributeNames?: Record<string, string>;
	limit?: number;
	exclusiveStartKey?: Record<string, unknown>;
}

/**
 * Generic repository for DynamoDB CRUD operations
 */
export class Repository<T extends BaseEntity> {
	constructor(private config: RepositoryConfig) {}

	/**
	 * Get item by ID
	 */
	async get(id: string): Promise<T | null> {
		const result = await docClient.send(
			new GetCommand({
				TableName: this.config.tableName,
				Key: { id },
			}),
		);

		return (result.Item as T) || null;
	}

	/**
	 * Create new item
	 */
	async create(item: Omit<T, "createdAt" | "updatedAt">): Promise<T> {
		const now = new Date().toISOString();
		const itemWithTimestamps = {
			...item,
			createdAt: now,
			updatedAt: now,
		} as T;

		await docClient.send(
			new PutCommand({
				TableName: this.config.tableName,
				Item: itemWithTimestamps,
				ConditionExpression: "attribute_not_exists(id)", // Prevent overwrites
			}),
		);

		return itemWithTimestamps;
	}

	/**
	 * Update existing item
	 * Uses ExpressionAttributeNames for all fields to avoid DynamoDB reserved word conflicts
	 */
	async update(id: string, updates: Partial<Omit<T, "id" | "createdAt">>): Promise<T> {
		const now = new Date().toISOString();
		const updateExpressions: string[] = ["#updatedAt = :updatedAt"];
		const expressionAttributeValues: Record<string, unknown> = { ":updatedAt": now };
		const expressionAttributeNames: Record<string, string> = { "#updatedAt": "updatedAt" };

		// Build update expression from provided fields (skip undefined values)
		Object.entries(updates).forEach(([key, value]) => {
			if (key !== "id" && key !== "createdAt" && value !== undefined) {
				const placeholder = `:${key}`;
				const attributeName = `#${key}`;
				updateExpressions.push(`${attributeName} = ${placeholder}`);
				expressionAttributeValues[placeholder] = value;
				expressionAttributeNames[attributeName] = key;
			}
		});

		const result = await docClient.send(
			new UpdateCommand({
				TableName: this.config.tableName,
				Key: { id },
				UpdateExpression: `SET ${updateExpressions.join(", ")}`,
				ExpressionAttributeValues: expressionAttributeValues,
				ExpressionAttributeNames: expressionAttributeNames,
				ReturnValues: "ALL_NEW",
				ConditionExpression: "attribute_exists(id)", // Ensure item exists
			}),
		);

		return result.Attributes as T;
	}

	/**
	 * Delete item by ID
	 */
	async delete(id: string): Promise<void> {
		await docClient.send(
			new DeleteCommand({
				TableName: this.config.tableName,
				Key: { id },
			}),
		);
	}

	/**
	 * Query items using GSI or primary key
	 */
	async query(options: QueryOptions): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, unknown> }> {
		const params: QueryCommandInput = {
			TableName: this.config.tableName,
			IndexName: options.indexName,
			KeyConditionExpression: options.keyConditionExpression,
			ExpressionAttributeValues: options.expressionAttributeValues,
			ExpressionAttributeNames: options.expressionAttributeNames,
			FilterExpression: options.filterExpression,
			ScanIndexForward: options.scanIndexForward,
			Limit: options.limit,
			ExclusiveStartKey: options.exclusiveStartKey,
		};

		const result = await docClient.send(new QueryCommand(params));

		return {
			items: (result.Items as T[]) || [],
			lastEvaluatedKey: result.LastEvaluatedKey,
		};
	}

	/**
	 * Scan entire table (use sparingly, prefer query)
	 */
	async scan(options?: ScanOptions): Promise<{ items: T[]; lastEvaluatedKey?: Record<string, unknown> }> {
		const params: ScanCommandInput = {
			TableName: this.config.tableName,
			FilterExpression: options?.filterExpression,
			ExpressionAttributeValues: options?.expressionAttributeValues,
			ExpressionAttributeNames: options?.expressionAttributeNames,
			Limit: options?.limit,
			ExclusiveStartKey: options?.exclusiveStartKey,
		};

		const result = await docClient.send(new ScanCommand(params));

		return {
			items: (result.Items as T[]) || [],
			lastEvaluatedKey: result.LastEvaluatedKey,
		};
	}

	/**
	 * Batch get items (up to 100 items)
	 */
	async batchGet(ids: string[]): Promise<T[]> {
		if (ids.length === 0) return [];
		if (ids.length > 100) throw new Error("Batch get supports max 100 items");

		// DynamoDB BatchGetItem is more complex, use Promise.all with GetCommand for simplicity
		const results = await Promise.all(ids.map((id) => this.get(id)));
		return results.filter((item) => item !== null) as T[];
	}
}
