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
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { appRouter } from "../../lib/trpc";
import { createContext } from "../../lib/trpc/context";
import { parseLambdaEnv } from "../utils/env";
import { Sentry } from "../utils/sentry";
import { auth } from "./auth";
import { TrpcLambdaEnvironmentSchema } from "./types";

const env = parseLambdaEnv(TrpcLambdaEnvironmentSchema);

// Initialize Logger and Tracer outside handler for reuse across invocations
const logger = new Logger({
	serviceName: "vcm-api",
	logLevel: (env.LOG_LEVEL || "INFO") as "DEBUG" | "INFO" | "WARN" | "ERROR",
});

const tracer = new Tracer({
	serviceName: "vcm-api",
	enabled: true,
});

const baseTrpcHandler = awsLambdaRequestHandler({
	router: appRouter,
	createContext: async (opts: { event: APIGatewayProxyEventV2 }) => {
		return createContext({ headers: buildHeaders(opts.event) });
	},
});

/** Convert API Gateway V2 event headers to a Web API Headers object */
function buildHeaders(event: APIGatewayProxyEventV2): Headers {
	const headers = new Headers();
	for (const [key, value] of Object.entries(event.headers || {})) {
		if (value) headers.set(key, value);
	}

	// API Gateway HTTP API can pass cookies in event.cookies instead of headers.cookie.
	if (event.cookies && event.cookies.length > 0 && !headers.has("cookie")) {
		headers.set("cookie", event.cookies.join("; "));
	}

	return headers;
}

/** Convert API Gateway V2 event to a Fetch API Request for better-auth */
function toFetchRequest(event: APIGatewayProxyEventV2): Request {
	const headers = buildHeaders(event);
	const scheme = headers.get("x-forwarded-proto") || "https";
	const host = headers.get("x-forwarded-host") || headers.get("host") || event.requestContext.domainName || "localhost";
	const url = `${scheme}://${host}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`;

	return new Request(url, {
		method: event.requestContext.http.method,
		headers,
		body: event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body) : null,
	});
}

/** Convert a Fetch API Response to an API Gateway V2 response */
async function fromFetchResponse(response: Response): Promise<APIGatewayProxyResultV2> {
	const headers: Record<string, string> = {};
	response.headers.forEach((value, key) => {
		// Combine multiple Set-Cookie headers (comma-separated is OK for most headers,
		// but Set-Cookie needs special handling — API GW V2 supports multi-value headers)
		if (key.toLowerCase() !== "set-cookie") {
			headers[key] = value;
		}
	});

	// Handle Set-Cookie headers separately (push each value directly — do NOT split,
	// as cookie values can contain ", " in Expires dates)
	const setCookieValues: string[] = [];
	response.headers.forEach((value, key) => {
		if (key.toLowerCase() === "set-cookie") {
			setCookieValues.push(value);
		}
	});

	const body = await response.text();

	const result: APIGatewayProxyResultV2 & { cookies?: string[] } = {
		statusCode: response.status,
		headers,
		body,
	};

	if (setCookieValues.length > 0) {
		result.cookies = setCookieValues;
	}

	return result;
}

// Lambda handler wrapped with Powertools middleware
const lambdaHandler = async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
	// Add request metadata to all logs for this invocation
	logger.appendKeys({
		path: event.rawPath || event.requestContext?.http?.path || "unknown",
		method: event.requestContext?.http?.method || "unknown",
	});

	try {
		// Route /api/auth/* requests to better-auth
		const path = event.rawPath || "";
		if (path.startsWith("/api/auth/") || path === "/api/auth") {
			const request = toFetchRequest(event);
			const response = await auth.handler(request);
			return fromFetchResponse(response);
		}

		// Route everything else to tRPC
		const result = await baseTrpcHandler(event, context);

		logger.info("Request completed successfully", {
			statusCode: result.statusCode,
		});

		return result;
	} catch (error) {
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
		logger.resetKeys();
	}
};

// Export handler wrapped with Powertools middleware for logging and tracing
export const handler = Sentry.wrapHandler(
	middy(lambdaHandler)
		.use(captureLambdaHandler(tracer, { captureResponse: false }))
		.use(injectLambdaContext(logger)),
);
