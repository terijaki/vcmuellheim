import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { type LambdaLogger, createLambdaLogger } from "./logger";

export function createLambdaResources(serviceName: string): { logger: LambdaLogger } {
  return { logger: createLambdaLogger(serviceName) };
}

export function createDynamoDocClient(): DynamoDBDocumentClient {
  const baseClient = new DynamoDBClient({});
  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}
