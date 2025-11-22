/**
 * AWS Lambda handler for tRPC API
 * This will be deployed as a Lambda function behind API Gateway
 */

import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { appRouter } from "../../lib/trpc";
import { createContext } from "../../lib/trpc/context";

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext: async (_opts: { event: APIGatewayProxyEventV2 }) => {
		// TODO: Extract userId from Cognito authorizer claims
		// event.requestContext.authorizer?.jwt?.claims?.sub
		return createContext();
	},
});
