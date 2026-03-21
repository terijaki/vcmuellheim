/**
 * DynamoDB client configuration
 */

import { Tracer } from "@aws-lambda-powertools/tracer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getContentTableName, type TableEntity } from "./env";

/**
 * Get the content table name for any entity.
 * All content entities share a single DynamoDB table (single-table design).
 * @deprecated Prefer `getContentTableName()` directly. Kept for backward compatibility.
 */
export function getTableName(_entity: TableEntity): string {
	return getContentTableName();
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
