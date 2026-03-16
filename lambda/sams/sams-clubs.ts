import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { slugify } from "@/utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { ClubResponseSchema, ClubsResponseSchema, SamsClubsLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-clubs");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsClubsLambdaEnvironmentSchema);
const TABLE_NAME = env.CLUBS_TABLE_NAME;

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	logger.appendKeys({ path: event.path });
	logger.info("📋 Querying clubs from DynamoDB", { pathParameters: event.pathParameters });

	const { uuid } = event.pathParameters || {};
	const { name } = event.queryStringParameters || {};

	if (!TABLE_NAME) {
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ error: "CLUBS_TABLE_NAME environment variable is not set" }),
		};
	}

	try {
		// Check if this is a request for a specific club by UUID
		if (uuid) {
			// Get specific club by UUID (primary key lookup)
			console.log(`🔍 Fetching club by UUID: ${uuid}`);

			const result = await docClient.send(
				new GetCommand({
					TableName: TABLE_NAME,
					Key: {
						sportsclubUuid: uuid,
					},
				}),
			);

			if (!result.Item) {
				return {
					statusCode: 404,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "public, max-age=259200", // 3 days
					},
					body: JSON.stringify({ error: "Club not found" }),
				};
			}

			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=259200",
				},
				body: JSON.stringify(ClubResponseSchema.parse(result.Item)),
			};
		}

		// Check if filtering by name query parameter
		if (name) {
			// Query by name using nameSlug GSI with prefix matching (case-insensitive)
			const slugifiedName = slugify(name);
			console.log(`🔍 Querying club by name prefix: ${name} (slug: ${slugifiedName})`);

			const result = await docClient.send(
				new QueryCommand({
					TableName: TABLE_NAME,
					IndexName: "GSI-SamsClubQueries",
					KeyConditionExpression: "#type = :type AND begins_with(nameSlug, :nameSlug)",
					ExpressionAttributeNames: {
						"#type": "type",
					},
					ExpressionAttributeValues: {
						":type": "club",
						":nameSlug": slugifiedName,
					},
				}),
			);

			if (!result.Items || result.Items.length === 0) {
				return {
					statusCode: 404,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "public, max-age=259200", // 3 days
					},
					body: JSON.stringify({ error: "Club not found" }),
				};
			}

			// Return first match if exact match, otherwise all prefix matches
			const exactMatch = result.Items.find((item: unknown) => {
				if (!item || typeof item !== "object") {
					return false;
				}

				if (!("nameSlug" in item)) {
					return false;
				}

				const nameSlug = item.nameSlug;
				return typeof nameSlug === "string" && nameSlug === slugifiedName;
			});
			if (exactMatch) {
				return {
					statusCode: 200,
					headers: {
						"Content-Type": "application/json",
						"Cache-Control": "public, max-age=259200",
					},
					body: JSON.stringify(ClubResponseSchema.parse(exactMatch)),
				};
			}

			// Return all prefix matches
			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=259200",
				},
				body: JSON.stringify(
					ClubsResponseSchema.parse({
						clubs: result.Items.map((item: unknown) => ClubResponseSchema.parse(item)),
						count: result.Items.length,
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
				"Cache-Control": "public, max-age=259200",
			},
			body: JSON.stringify(
				ClubsResponseSchema.parse({
					clubs: result.Items?.map((item: unknown) => ClubResponseSchema.parse(item)) ?? [],
					count: result.Items?.length ?? 0,
				}),
			),
		};
	} catch (error) {
		logger.error("🚨 Error querying clubs:", { error });
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
		};
	}
};

export const handler = Sentry.wrapHandler(middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)));
