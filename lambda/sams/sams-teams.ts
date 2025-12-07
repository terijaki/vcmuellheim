import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getTeamByUuid } from "@/codegen/sams/generated";
import { slugify } from "@/utils/slugify";
import { TeamItemSchema, TeamResponseSchema, TeamsResponseSchema } from "./types";

const logger = new Logger({ serviceName: "sams-teams" });
const tracer = new Tracer({ serviceName: "sams-teams" });

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(tracer.captureAWSv3Client(client));

const TEAMS_TABLE_NAME = process.env.TEAMS_TABLE_NAME;
const SAMS_API_KEY = process.env.SAMS_API_KEY;

if (!TEAMS_TABLE_NAME) {
	throw new Error("❌ TEAMS_TABLE_NAME environment variable is required");
}

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	logger.appendKeys({ path: event.path });
	logger.info("Getting SAMS teams", { pathParameters: event.pathParameters });
	try {
		if (!SAMS_API_KEY) {
			console.error("SAMS API key not configured");
			return {
				statusCode: 500,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "no-cache",
				},
				body: JSON.stringify({ error: "Server configuration error." }),
			};
		}

		const { uuid } = event.pathParameters || {};
		const { name } = event.queryStringParameters || {};

		// Case 1: Get team by UUID (path parameter)
		if (uuid) {
			const command = new GetCommand({
				TableName: TEAMS_TABLE_NAME,
				Key: { uuid },
			});

			const result = await docClient.send(command);

			if (!result.Item) {
				console.log(`🔍 Fetching team by UUID: ${uuid}`);
				const { data } = await getTeamByUuid({
					path: { uuid },
					headers: {
						"X-API-Key": SAMS_API_KEY,
					},
				});
				if (data) {
					// Parse with TeamItemSchema, then convert to response format
					const freshTeam = TeamItemSchema.parse(data);
					const responseTeam = TeamResponseSchema.parse(freshTeam);
					return {
						statusCode: 200,
						headers: {
							"Content-Type": "application/json",
							"Cache-Control": "public, max-age=43200",
						},
						body: JSON.stringify(responseTeam),
					};
				}

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
					"Cache-Control": "public, max-age=43200",
				},
				body: JSON.stringify(responseTeam),
			};
		}

		// Case 2: Query teams by filters (or all teams if no filter provided)
		let teams: unknown[] = [];

		if (name) {
			// Query by name using nameSlug GSI (case-insensitive)
			const slugifiedName = slugify(name);
			console.log(`🔍 Querying team by nameSlug: ${name} (slug: ${slugifiedName})`);
			const command = new QueryCommand({
				TableName: TEAMS_TABLE_NAME,
				IndexName: "GSI-SamsTeamQueries",
				KeyConditionExpression: "#type = :type AND nameSlug = :nameSlug",
				ExpressionAttributeNames: {
					"#type": "type",
				},
				ExpressionAttributeValues: {
					":type": "club",
					":nameSlug": slugifiedName,
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
				"Cache-Control": "public, max-age=43200",
			},
			body: JSON.stringify(response),
		};
	} catch (error) {
		logger.error("Error querying teams:", { error });
		return {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};

export const handler = middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer));
