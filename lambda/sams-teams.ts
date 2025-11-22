import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { slugify } from "@/utils/slugify";
import { TeamItemSchema, TeamResponseSchema, TeamsResponseSchema } from "./types";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TEAMS_TABLE_NAME = process.env.TEAMS_TABLE_NAME;

if (!TEAMS_TABLE_NAME) {
	throw new Error("❌ TEAMS_TABLE_NAME environment variable is required");
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	try {
		const { uuid } = event.pathParameters || {};
		const { name, sportsclub, league } = event.queryStringParameters || {};

		// Case 1: Get team by UUID (path parameter)
		if (uuid) {
			const command = new GetCommand({
				TableName: TEAMS_TABLE_NAME,
				Key: { uuid },
			});

			const result = await docClient.send(command);

			if (!result.Item) {
				return {
					statusCode: 404,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ error: "Team not found" }),
				};
			}

			// Parse with TeamItemSchema, then convert to response format
			const team = TeamItemSchema.parse(result.Item);
			const responseTeam = TeamResponseSchema.parse(team);

			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=43200", // 12 hours cache (synced every 24h at 3 AM, max 12h stale)
				},
				body: JSON.stringify(responseTeam),
			};
		}

		// Case 2: Query teams by filters (or all teams if no filter provided)
		let teams: unknown[] = [];

		if (name) {
			// Query by name slug (case-insensitive)
			const nameSlug = slugify(name);
			const command = new QueryCommand({
				TableName: TEAMS_TABLE_NAME,
				IndexName: "nameSlug-index",
				KeyConditionExpression: "nameSlug = :nameSlug",
				ExpressionAttributeValues: {
					":nameSlug": nameSlug,
				},
			});

			const result = await docClient.send(command);
			teams = result.Items || [];
		} else if (sportsclub) {
			// Query by sportsclub UUID
			const command = new QueryCommand({
				TableName: TEAMS_TABLE_NAME,
				IndexName: "sportsclubUuid-index",
				KeyConditionExpression: "sportsclubUuid = :sportsclubUuid",
				ExpressionAttributeValues: {
					":sportsclubUuid": sportsclub,
				},
			});

			const result = await docClient.send(command);
			teams = result.Items || [];
		} else if (league) {
			// Query by league UUID
			const command = new QueryCommand({
				TableName: TEAMS_TABLE_NAME,
				IndexName: "leagueUuid-index",
				KeyConditionExpression: "leagueUuid = :leagueUuid",
				ExpressionAttributeValues: {
					":leagueUuid": league,
				},
			});

			const result = await docClient.send(command);
			teams = result.Items || [];
		} else {
			// No filters provided - return all teams (since we only store our club's teams)
			const command = new ScanCommand({
				TableName: TEAMS_TABLE_NAME,
			});

			const result = await docClient.send(command);
			teams = result.Items || [];
		}

		// Parse and validate response
		const response = TeamsResponseSchema.parse({ teams });

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=43200", // 12 hours cache (synced every 24h at 3 AM, max 12h stale)
			},
			body: JSON.stringify(response),
		};
	} catch (error) {
		console.error("Error querying teams:", error);
		return {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
