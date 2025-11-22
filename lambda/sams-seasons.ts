import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import dayjs from "dayjs";
import { getAllSeasons } from "@/data/sams/client";
import { SeasonsResponseSchema } from "./types";

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	try {
		console.log("Getting SAMS seasons", { event: JSON.stringify(event) });

		const apiKey = process.env.SAMS_API_KEY;

		if (!apiKey) {
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

		const { data: seasons } = await getAllSeasons({
			headers: {
				"X-API-Key": apiKey,
			},
		});
		if (!seasons || seasons.length === 0) {
			return {
				statusCode: 404,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=300", // Cache 404s briefly (5 minutes)
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
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=300", // Cache 404s briefly (5 minutes)
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
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, max-age=43200", // 12 hours cache (seasons rarely change)
			},
			body: JSON.stringify(result),
		};
	} catch (error) {
		console.error("Error fetching seasons:", error);
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
