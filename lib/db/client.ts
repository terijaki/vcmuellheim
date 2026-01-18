/**
 * DynamoDB client configuration
 */

import { Tracer } from "@aws-lambda-powertools/tracer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { TABLES, type TableEntity, tableEnvVar } from "./env";

/** Table names for all entities - provided by CDK as environment variables */
export const TABLE_NAMES = Object.fromEntries(
	TABLES.map((entity) => {
		const envVar = tableEnvVar(entity);
		const tableName = process.env[envVar];
		// Only validate table names that are actually set
		// Lambdas may only need access to subset of tables
		if (!tableName) {
			return [entity, undefined];
		}
		return [entity, tableName];
	}),
) as Record<TableEntity, string | undefined>;

/** Get table name for an entity, throwing if not configured */
export function getTableName(entity: TableEntity): string {
	const tableName = TABLE_NAMES[entity];
	if (!tableName) {
		const envVar = tableEnvVar(entity);
		throw new Error(`Table ${entity} not configured. Missing environment variable: ${envVar}`);
	}
	return tableName;
}

/** DynamoDB client instance with X-Ray tracing */
const dynamoDBClient = new DynamoDBClient({
	// AWS_REGION is automatically set by Lambda runtime
	region: process.env.AWS_REGION || "eu-central-1",
});

// Instrument DynamoDB client with X-Ray tracing to capture query timings
const tracer = new Tracer({ serviceName: "vcm-api" });
const tracedDynamoDBClient = tracer.captureAWSv3Client(dynamoDBClient);

/** Document client for easier data marshalling with tracing enabled */
export const docClient = DynamoDBDocumentClient.from(tracedDynamoDBClient, {
	marshallOptions: {
		removeUndefinedValues: true, // Remove undefined fields
		convertClassInstanceToMap: true,
	},
	unmarshallOptions: {
		wrapNumbers: false, // Return numbers as native JavaScript numbers
	},
});

/** Export raw client for advanced use cases */
export { tracedDynamoDBClient as dynamoDBClient };
