/**
 * DynamoDB client configuration
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/** DynamoDB client instance */
const dynamoDBClient = new DynamoDBClient({});

/** Document client for easier data marshalling */
export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined fields
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false, // Return numbers as native JavaScript numbers
  },
});

/** Export raw client for advanced use cases */
export { dynamoDBClient };
