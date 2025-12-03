/**
 * AWS Lambda handler for Content API (tRPC)
 * This will be deployed as a Lambda function behind API Gateway
 */

import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { appRouter } from "../../lib/trpc";
import { createContext } from "../../lib/trpc/context";

// Environment variables for Cognito verification
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.AWS_REGION || "eu-central-1";

export const handler = awsLambdaRequestHandler({
	router: appRouter,
	createContext: async (opts: { event: APIGatewayProxyEventV2 }) => {
		const authorizationHeader = opts.event.headers.authorization || opts.event.headers.Authorization;

		return createContext({
			authorizationHeader,
			userPoolId: USER_POOL_ID,
			region: REGION,
		});
	},
});
