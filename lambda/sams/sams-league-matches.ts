import { getAllLeagueMatches, type LeagueMatchDto } from "@codegen/sams/generated";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import dayjs from "dayjs";
import { LeagueMatchesResponseSchema } from "./types";

const SAMS_API_KEY = process.env.SAMS_API_KEY;

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
	try {
		console.log("Getting SAMS league matches", { event: JSON.stringify(event) });

		if (!SAMS_API_KEY) {
			console.error("SAMS API key not configured");
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "no-cache", // Don't cache errors
				},
				body: JSON.stringify({ error: "Server configuration error." }),
			};
		}

		// Parse query parameters
		const queryParams = event.queryStringParameters || {};
		let { league, season, sportsclub, team, limit, range } = queryParams;

		// Get current season if not specified
		if (!season) {
			try {
				const seasonsResponse = await fetch(`https://${event.requestContext.domainName}/v1/sams/seasons`);
				if (seasonsResponse.ok) {
					const seasonsData = await seasonsResponse.json();
					season = seasonsData.current?.uuid;
				}
			} catch (error) {
				console.warn("Failed to fetch current season, proceeding without default:", error);
				return {
					statusCode: 400,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
						"Cache-Control": "no-cache", // Don't cache errors
					},
					body: JSON.stringify({ error: "Unable to determine season automatically. Please specify a season." }),
				};
			}
		}

		// Build API request parameters
		const defaultQueryParams: Record<string, string> = {};
		if (league) defaultQueryParams["for-league"] = league;
		if (season) defaultQueryParams["for-season"] = season;
		if (sportsclub) defaultQueryParams["for-sportsclub"] = sportsclub;
		if (team) defaultQueryParams["for-team"] = team; // Fetch all matches with pagination
		const allMatches: Omit<LeagueMatchDto, "_links">[] = [];
		let currentPage = 0;
		let hasMorePages = true;
		while (hasMorePages) {
			const { data } = await getAllLeagueMatches({
				query: {
					...defaultQueryParams,
					page: currentPage,
				},
				headers: {
					"X-API-Key": SAMS_API_KEY,
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
			// Filter by matches without a winner (not yet played)
			filteredMatches = allMatches.filter((m) => !m.results?.winner);
		} else if (range === "past") {
			// Filter by matches with a winner (already played)
			filteredMatches = allMatches.filter((m) => m.results?.winner);
		} // Sort matches by date
		if (range === "future") {
			filteredMatches.sort((a, b) => {
				if (!a.date) return 1;
				if (!b.date) return -1;
				return dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1;
			});
		} else if (range === "past") {
			filteredMatches.sort((a, b) => {
				if (!a.date) return 1;
				if (!b.date) return -1;
				return dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1;
			});
		} // Apply limit if specified
		if (limit) {
			const limitNum = parseInt(limit, 10);
			if (!Number.isNaN(limitNum)) {
				filteredMatches = filteredMatches.slice(0, limitNum);
			}
		}

		const result = LeagueMatchesResponseSchema.parse({
			matches: filteredMatches,
			timestamp: new Date().toISOString(),
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
		console.error("Error fetching league matches:", error);
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
