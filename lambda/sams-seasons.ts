import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { getAllSeasons, type SeasonDto } from "@/data/sams/client";

type SeasonsResponse = {
	current: SeasonDto[number];
	next: SeasonDto[number] | undefined;
	previous: SeasonDto[number] | undefined;
};

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
				},
				body: JSON.stringify({ error: "SAMS API key not configured" }),
			};
		}

		// Use the shared SAMS client (matches pattern from sams-server-actions.ts)
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
				},
				body: JSON.stringify({ error: "No current season found" }),
			};
		}

		// Find next and previous seasons based on dates
		const nextSeason = seasons.find((s) => {
			if (!s.startDate || !currentSeason.endDate) return false;
			const seasonStart = new Date(s.startDate);
			const currentEnd = new Date(currentSeason.endDate);
			const dayAfterCurrentEnd = new Date(currentEnd);
			dayAfterCurrentEnd.setDate(dayAfterCurrentEnd.getDate() + 1);
			return seasonStart.toDateString() === dayAfterCurrentEnd.toDateString();
		});

		const previousSeason = seasons.find((s) => {
			if (!s.endDate || !currentSeason.startDate) return false;
			const seasonEnd = new Date(s.endDate);
			const currentStart = new Date(currentSeason.startDate);
			const dayBeforeCurrentStart = new Date(currentStart);
			dayBeforeCurrentStart.setDate(dayBeforeCurrentStart.getDate() - 1);
			return seasonEnd.toDateString() === dayBeforeCurrentStart.toDateString();
		});

		const result: SeasonsResponse = {
			current: currentSeason,
			next: nextSeason,
			previous: previousSeason,
		};

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
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
			},
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
