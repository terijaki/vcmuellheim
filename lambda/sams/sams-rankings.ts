import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { getLeagueByUuid, getRankingsForLeague, getSeasonByUuid } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { RankingResponseSchema } from "./types";

const logger = new Logger({ serviceName: "sams-rankings" });
const tracer = new Tracer({ serviceName: "sams-rankings" });

const SAMS_API_KEY = process.env.SAMS_API_KEY;

const lambdaHandler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	logger.appendKeys({ path: event.path });
	logger.info("Getting SAMS rankings", { pathParameters: event.pathParameters });
	try {
		if (!SAMS_API_KEY) {
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
				},
				body: JSON.stringify({ error: "SAMS API key not configured" }),
			};
		}

		const leagueUuid = event.pathParameters?.leagueUuid;
		if (!leagueUuid) {
			return {
				statusCode: 400,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
				},
				body: JSON.stringify({ error: "League UUID is required" }),
			};
		}

		const { data } = await getRankingsForLeague({
			path: { uuid: leagueUuid },
			query: { page: 0, size: 100 },
			headers: {
				"X-API-Key": SAMS_API_KEY,
			},
		});

		if (!data?.content) {
			return {
				statusCode: 404,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=300",
				},
				body: JSON.stringify({ error: "No rankings found for this league" }),
			};
		}

		let leagueName: string | undefined;
		let seasonName: string | undefined;

		const { data: leagueData } = await getLeagueByUuid({
			path: { uuid: leagueUuid },
			headers: {
				"X-API-Key": SAMS_API_KEY,
			},
		});
		if (leagueData?.name) leagueName = leagueData.name;

		if (leagueData?.seasonUuid) {
			const { data: seasonData } = await getSeasonByUuid({
				path: { uuid: leagueData.seasonUuid },
				headers: {
					"X-API-Key": SAMS_API_KEY,
				},
			});
			if (seasonData?.name) seasonName = seasonData.name;
		}

		const result = RankingResponseSchema.parse({
			teams: data.content,
			timestamp: new Date().toISOString(),
			leagueUuid,
			leagueName,
			seasonName,
		});

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=300",
			},
			body: JSON.stringify(result),
		};
	} catch (error) {
		logger.error("Error fetching rankings:", { error });
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
