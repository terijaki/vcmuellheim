import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { getRankingsForLeague } from "@/data/sams/client";
import { RankingSchema } from "./types";

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	try {
		console.log("Getting SAMS rankings", { event: JSON.stringify(event) });

		const apiKey = process.env.SAMS_API_KEY;

		if (!apiKey) {
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
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
				},
				body: JSON.stringify({ error: "League UUID is required" }),
			};
		}

		const { data } = await getRankingsForLeague({
			path: { uuid: leagueUuid },
			query: { page: 0, size: 100 },
			headers: {
				"X-API-Key": apiKey,
			},
		});

		if (!data?.content) {
			return {
				statusCode: 404,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({ error: "No rankings found for this league" }),
			};
		}

		const result = RankingSchema.parse({
			teams: data.content,
			timestamp: new Date(),
			leagueUuid,
		});

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
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
			},
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
