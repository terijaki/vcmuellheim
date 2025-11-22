/**
 * DynamoDB client configuration
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/** Environment-based table name prefix */
const getTablePrefix = () => {
	const branch = process.env.GITHUB_REF_NAME || "dev";
	return `vcm-${branch}`;
};

/** Table names for all entities */
export const TABLE_NAMES = {
	NEWS: `${getTablePrefix()}-news`,
	EVENTS: `${getTablePrefix()}-events`,
	TEAMS: `${getTablePrefix()}-teams`,
	MEMBERS: `${getTablePrefix()}-members`,
	MEDIA: `${getTablePrefix()}-media`,
	SPONSORS: `${getTablePrefix()}-sponsors`,
} as const;

/** DynamoDB client instance */
const client = new DynamoDBClient({
	region: process.env.AWS_REGION || "eu-central-1",
});

/** Document client for easier data marshalling */
export const docClient = DynamoDBDocumentClient.from(client, {
	marshallOptions: {
		removeUndefinedValues: true, // Remove undefined fields
		convertClassInstanceToMap: true,
	},
	unmarshallOptions: {
		wrapNumbers: false, // Return numbers as native JavaScript numbers
	},
});

/** Export raw client for advanced use cases */
export { client as dynamoDBClient };
