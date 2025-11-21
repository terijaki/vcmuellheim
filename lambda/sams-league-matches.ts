import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { getAllLeagueMatches, type LeagueMatchDto } from "../data/sams/client";

type LeagueMatches = { matches: Omit<LeagueMatchDto, "_links">[]; timestamp: Date };

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	try {
		console.log("Getting SAMS league matches", { event: JSON.stringify(event) });

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

		// Parse query parameters
		const queryParams = event.queryStringParameters || {};
		const { league, season, sportsclub, team, limit, range } = queryParams;

		// Build API request parameters
		const defaultQueryParams: Record<string, string> = {};
		if (league) defaultQueryParams["for-league"] = league;
		if (season) defaultQueryParams["for-season"] = season;
		if (sportsclub) defaultQueryParams["for-sportsclub"] = sportsclub;
		if (team) defaultQueryParams["for-team"] = team;

		// Fetch all matches with pagination
		const allMatches: Omit<LeagueMatchDto, "_links">[] = [];
		let currentPage = 0;
		let hasMorePages = true;

		while (hasMorePages) {
			// Use the shared SAMS client (matches pattern from sams-server-actions.ts)
			const { data } = await getAllLeagueMatches({
				query: {
					...defaultQueryParams,
					page: currentPage,
				},
				headers: {
					"X-API-Key": apiKey,
				},
			});

			if (data?.content) {
				const matches = data.content.map((m) => {
					// Drop _links properties
					const { _links, ...match } = m;
					return match;
				});
				allMatches.push(...matches);
				currentPage++;
			}

			if (data?.last === true) {
				hasMorePages = false;
			}
		}

		// Filter matches based on range
		let filteredMatches = allMatches;
		if (range === "future") {
			// Filter by absent winner (more reliable than date)
			filteredMatches = allMatches.filter((m) => !m.results?.winner);
		} else if (range === "past") {
			// Filter by past dates
			filteredMatches = allMatches.filter((m) => (m.date ? new Date(m.date) < new Date() : false));
		}

		// Sort matches by date
		if (range === "future") {
			filteredMatches.sort((a, b) => {
				const dateA = a.date ? new Date(a.date) : new Date(0);
				const dateB = b.date ? new Date(b.date) : new Date(0);
				return dateA.getTime() - dateB.getTime();
			});
		} else if (range === "past") {
			filteredMatches.sort((a, b) => {
				const dateA = a.date ? new Date(a.date) : new Date(0);
				const dateB = b.date ? new Date(b.date) : new Date(0);
				return dateB.getTime() - dateA.getTime();
			});
		}

		// Apply limit if specified
		if (limit) {
			const limitNum = parseInt(limit, 10);
			if (!Number.isNaN(limitNum)) {
				filteredMatches = filteredMatches.slice(0, limitNum);
			}
		}

		const result: LeagueMatches = {
			matches: filteredMatches,
			timestamp: new Date(),
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
		console.error("Error fetching league matches:", error);
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
