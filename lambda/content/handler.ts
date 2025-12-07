/**
 * AWS Lambda handler for Content API (tRPC)
 * This will be deployed as a Lambda function behind API Gateway
 */

import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { appRouter } from "../../lib/trpc";
import { createContext } from "../../lib/trpc/context";

// Environment variables for Cognito verification
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.AWS_REGION || "eu-central-1";

// Initialize Logger and Tracer outside handler for reuse across invocations
const logger = new Logger({
	serviceName: "vcm-api",
	logLevel: (process.env.LOG_LEVEL || "INFO") as "DEBUG" | "INFO" | "WARN" | "ERROR",
});

const tracer = new Tracer({
	serviceName: "vcm-api",
	enabled: process.env.POWERTOOLS_TRACE_ENABLED !== "false",
});

const baseTrpcHandler = awsLambdaRequestHandler({
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

// Lambda handler wrapped with Powertools middleware
const lambdaHandler = async (event: APIGatewayProxyEventV2, context: Context) => {
	// Add request metadata to all logs for this invocation
	logger.appendKeys({
		path: event.rawPath || event.requestContext?.http?.path || "unknown",
		method: event.requestContext?.http?.method || "unknown",
	});

	try {
		// Execute tRPC handler
		const result = await baseTrpcHandler(event, context);

		// Log successful response
		logger.info("Request completed successfully", {
			statusCode: result.statusCode,
		});

		return result;
	} catch (error) {
		// Log error - Powertools will capture the error automatically via middleware
		if (error instanceof Error) {
			logger.error("Request failed", {
				error: {
					message: error.message,
				},
			});
		} else {
			logger.error("Request failed with unknown error", {
				error: String(error),
			});
		}

		throw error;
	} finally {
		// Reset temporary keys after request
		logger.resetKeys();
	}
};

// Export handler wrapped with Powertools middleware for logging and tracing
export const handler = middy(lambdaHandler)
	.use(captureLambdaHandler(tracer, { captureResponse: false }))
	.use(injectLambdaContext(logger));
