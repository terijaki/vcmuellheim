import { type Association, getAssociations } from "@codegen/sams/generated";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	try {
		console.log("Getting SAMS associations", { event: JSON.stringify(event) });

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

		// Check if we're looking for a specific association by name
		const associationName = event.pathParameters?.name;

		const allAssociations: Association[] = [];
		let currentPage = 0;
		let hasMorePages = true;
		while (hasMorePages) {
			const { data, error, response } = await getAssociations({
				query: { page: currentPage, size: 100 },
				headers: {
					"X-API-Key": apiKey,
				},
			});

			if (error) {
				return {
					statusCode: response.status,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
					body: JSON.stringify({
						error: `Error fetching associations page ${currentPage}`,
						details: error,
					}),
				};
			}

			if (data.content) {
				allAssociations.push(...data.content);
				currentPage++;
			}

			if (data.last === true) {
				hasMorePages = false;
			}
		}

		// If looking for a specific association by name
		if (associationName) {
			const desiredAssociation = allAssociations.find((a) => a.name?.toLowerCase() === associationName.toLowerCase());

			if (!desiredAssociation) {
				return {
					statusCode: 404,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
					body: JSON.stringify({
						error: `Association with name '${associationName}' not found`,
					}),
				};
			}

			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=86400", // Cache for 24 hours (expensive external API)
				},
				body: JSON.stringify({
					association: desiredAssociation,
					timestamp: new Date().toISOString(),
				}),
			};
		}

		// Return all associations
		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, max-age=86400", // Cache for 24 hours (expensive external API)
			},
			body: JSON.stringify({
				associations: allAssociations,
				total: allAssociations.length,
				timestamp: new Date().toISOString(),
			}),
		};
	} catch (error) {
		console.error("Error fetching associations:", error);

		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: "Failed to fetch associations",
				message: error instanceof Error ? error.message : "Unknown error",
				timestamp: new Date().toISOString(),
			}),
		};
	}
};
