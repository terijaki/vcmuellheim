import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export function createLambdaResources(serviceName: string): { logger: Logger; tracer: Tracer } {
	const logger = new Logger({ serviceName });
	const tracer = new Tracer({ serviceName });

	return { logger, tracer };
}

export function createDynamoDocClient(tracer: Tracer): DynamoDBDocumentClient {
	const baseClient = new DynamoDBClient({});
	const dynamoClient = tracer.captureAWSv3Client(baseClient);
	return DynamoDBDocumentClient.from(dynamoClient);
}
