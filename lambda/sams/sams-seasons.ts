import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { getAllSeasons } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import dayjs from "dayjs";
import { SeasonsResponseSchema } from "./types";

const logger = new Logger({ serviceName: "sams-seasons" });
const tracer = new Tracer({ serviceName: "sams-seasons" });

const SAMS_API_KEY = process.env.SAMS_API_KEY;

const lambdaHandler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	logger.appendKeys({ path: event.path });
	logger.info("Getting SAMS seasons", { pathParameters: event.pathParameters });
	try {
		if (!SAMS_API_KEY) {
			console.error("SAMS API key not configured");
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
				},
				body: JSON.stringify({ error: "Server configuration error." }),
			};
		}

		const { data: seasons } = await getAllSeasons({
			headers: {
				"X-API-Key": SAMS_API_KEY,
			},
		});
		if (!seasons || seasons.length === 0) {
			return {
				statusCode: 404,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=300",
				},
				body: JSON.stringify({ error: "No seasons found" }),
			};
		}

		const currentSeason = seasons.find((s) => s.currentSeason);

		if (!currentSeason) {
			return {
				statusCode: 404,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=300",
				},
				body: JSON.stringify({ error: "No current season found" }),
			};
		}
		const nextSeason = seasons.find((s) => dayjs(s.startDate).subtract(1, "day").isSame(currentSeason.endDate));
		const previousSeason = seasons.find((s) => dayjs(s.endDate).add(1, "day").isSame(currentSeason.startDate));

		const result = SeasonsResponseSchema.parse({
			current: currentSeason,
			next: nextSeason,
			previous: previousSeason,
		});

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=43200",
			},
			body: JSON.stringify(result),
		};
	} catch (error) {
		console.error("Error fetching seasons:", error);
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
			},
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};

export const handler = middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer));
