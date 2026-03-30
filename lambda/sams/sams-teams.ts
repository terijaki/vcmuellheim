import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { getTeamByUuid } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { slugify } from "@/utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { SamsTeamsLambdaEnvironmentSchema, TeamItemSchema, TeamResponseSchema, TeamsResponseSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-teams");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsTeamsLambdaEnvironmentSchema);
const TABLE_NAME = env.SAMS_TABLE_NAME;
const SAMS_API_KEY = env.SAMS_API_KEY;
const samsEntities = createSamsDb(docClient, TABLE_NAME);

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
			const result = await samsEntities.team.get({ uuid }).go();

			if (!result.data) {
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
			const team = TeamItemSchema.parse(result.data);
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
			const result = await samsEntities.team.query.byType({ type: "team" }).begins({ nameSlug: slugifiedName }).go({ pages: "all" });
			// Prefer exact nameSlug matches; fall back to all prefix matches if none are exact
			const exactMatches = result.data.filter((t) => t.nameSlug === slugifiedName);
			teams = exactMatches.length > 0 ? exactMatches : result.data;
		} else {
			// No filters provided - return all teams (since we only store our club's teams)
			const result = await samsEntities.team.query.byType({ type: "team" }).go({ pages: "all" });
			teams = result.data;
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

export const handler = Sentry.wrapHandler(middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)));
