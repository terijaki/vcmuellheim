import { getRankingsForLeague } from "@codegen/sams/generated";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { RankingResponseSchema } from "./types";

const SAMS_API_KEY = process.env.SAMS_API_KEY;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	try {
		console.log("Getting SAMS rankings", { event: JSON.stringify(event) });

		if (!SAMS_API_KEY) {
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "no-cache", // Don't cache errors
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
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "no-cache", // Don't cache errors
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
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=300", // Cache 404s briefly (5 minutes)
				},
				body: JSON.stringify({ error: "No rankings found for this league" }),
			};
		}

		const result = RankingResponseSchema.parse({
			teams: data.content,
			timestamp: new Date().toISOString(),
			leagueUuid,
		});

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, max-age=300", // 5 minutes cache (live SAMS data)
			},
			body: JSON.stringify(result),
		};
	} catch (error) {
		console.error("Error fetching rankings:", error);
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "no-cache", // Don't cache errors
			},
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
