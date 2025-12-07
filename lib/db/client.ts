/**
 * DynamoDB client configuration
 */

import { Tracer } from "@aws-lambda-powertools/tracer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { TABLES, tableEnvVar } from "./env";

/** Table names for all entities - provided by CDK as environment variables */
export const TABLE_NAMES = Object.fromEntries(
	TABLES.map((entity) => {
		const envVar = tableEnvVar(entity);
		const tableName = process.env[envVar];
		if (!tableName) {
			throw new Error(`Missing required environment variable: ${envVar}`);
		}
		return [entity, tableName];
	}),
) as Record<(typeof TABLES)[number], string>;

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
