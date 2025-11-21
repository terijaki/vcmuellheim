import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { slugify } from "@/utils/slugify";
import { ClubResponseSchema, ClubsResponseSchema } from "./types";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.CLUBS_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	console.log("📋 Querying clubs from DynamoDB", { path: event.path, pathParameters: event.pathParameters });

	if (!TABLE_NAME) {
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ error: "CLUBS_TABLE_NAME environment variable is not set" }),
		};
	}

	try {
		// Check if this is a request for a specific club by UUID
		const clubUuid = event.pathParameters?.uuid;

		if (clubUuid) {
			// Get specific club by UUID (primary key lookup)
			console.log(`🔍 Fetching club by UUID: ${clubUuid}`);

			const result = await docClient.send(
				new GetCommand({
					TableName: TABLE_NAME,
					Key: {
						sportsclubUuid: clubUuid,
					},
				}),
			);

			if (!result.Item) {
				return {
					statusCode: 404,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
					body: JSON.stringify({ error: "Club not found" }),
				};
			}

			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=86400", // 24 hours cache (data updates nightly)
				},
				body: JSON.stringify(ClubResponseSchema.parse(result.Item)),
			};
		}

		// Check if filtering by name query parameter
		const nameFilter = event.queryStringParameters?.name;

		if (nameFilter) {
			// Query by name using nameSlug GSI (case-insensitive)
			const slugifiedName = slugify(nameFilter);
			console.log(`🔍 Querying club by name: ${nameFilter} (slug: ${slugifiedName})`);

			const result = await docClient.send(
				new QueryCommand({
					TableName: TABLE_NAME,
					IndexName: "nameSlug-index",
					KeyConditionExpression: "nameSlug = :nameSlug",
					ExpressionAttributeValues: {
						":nameSlug": slugifiedName,
					},
				}),
			);

			if (!result.Items || result.Items.length === 0) {
				return {
					statusCode: 404,
					headers: {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*",
					},
					body: JSON.stringify({ error: "Club not found" }),
				};
			}

			// Return first match (names should be unique)
			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=86400", // 24 hours cache
				},
				body: JSON.stringify(ClubResponseSchema.parse(result.Items[0])),
			};
		} // Check if filtering by association
		const associationFilter = event.queryStringParameters?.association;

		if (associationFilter) {
			// Query by association using GSI
			console.log(`🔍 Querying clubs by association: ${associationFilter}`);

			const result = await docClient.send(
				new QueryCommand({
					TableName: TABLE_NAME,
					IndexName: "associationUuid-index",
					KeyConditionExpression: "associationUuid = :associationUuid",
					ExpressionAttributeValues: {
						":associationUuid": associationFilter,
					},
				}),
			);

			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
					"Cache-Control": "public, max-age=86400", // 24 hours cache
				},
				body: JSON.stringify(
					ClubsResponseSchema.parse({
						clubs: result.Items?.map((item) => ClubResponseSchema.parse(item)) ?? [],
						count: result.Items?.length ?? 0,
					}),
				),
			};
		}

		// No filters - return all clubs (scan)
		console.log("📊 Fetching all clubs");

		const result = await docClient.send(
			new ScanCommand({
				TableName: TABLE_NAME,
			}),
		);

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, max-age=86400", // 24 hours cache
			},
			body: JSON.stringify(
				ClubsResponseSchema.parse({
					clubs: result.Items?.map((item) => ClubResponseSchema.parse(item)) ?? [],
					count: result.Items?.length ?? 0,
				}),
			),
		};
	} catch (error) {
		console.error("🚨 Error querying clubs:", error);
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
		};
	}
};
