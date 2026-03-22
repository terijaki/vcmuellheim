import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { DeleteCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getAllLeagues, getAllSeasons, getTeamsForLeague } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { slugify } from "../../utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { SamsTeamsSyncLambdaEnvironmentSchema, TeamItemSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-teams-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsTeamsSyncLambdaEnvironmentSchema);
const CLUBS_TABLE_NAME = env.CLUBS_TABLE_NAME;
const TEAMS_TABLE_NAME = env.TEAMS_TABLE_NAME;

const lambdaHandler: APIGatewayProxyHandler = async () => {
	logger.info("Starting SAMS teams sync...");
	Sentry.addBreadcrumb({ category: "sync", message: "Starting SAMS teams sync", level: "info" });
	try {
		// Step 1: Get VC Müllheim club from DynamoDB
		console.log("Fetching VC Müllheim club data...");
		const clubSlug = slugify("VC Müllheim");
		const clubScan = await docClient.send(
			new ScanCommand({
				TableName: CLUBS_TABLE_NAME,
				FilterExpression: "nameSlug = :slug",
				ExpressionAttributeValues: {
					":slug": clubSlug,
				},
			}),
		);

		const club = clubScan.Items?.[0];
		if (!club) {
			throw new Error("VC Müllheim club not found in DynamoDB");
		}

		const { sportsclubUuid, associationUuid } = club;
		console.log(`Found club: ${club.name} (${sportsclubUuid})`);
		Sentry.addBreadcrumb({ category: "sync", message: `Found club: ${club.name} (${sportsclubUuid})`, level: "info" });

		// Step 2: Get current season
		console.log("Fetching current season...");
		const { data: seasons } = await getAllSeasons({});

		const currentSeason = seasons?.find((s) => s.currentSeason);
		if (!currentSeason) {
			throw new Error("Current season not found");
		}
		console.log(`Current season: ${currentSeason.name} (${currentSeason.uuid})`);

		// Step 3: Get all leagues for the association filtered by current season
		console.log(`Fetching leagues for association ${associationUuid}...`);
		const allLeagues = [];
		let leaguePage = 0;
		let hasMoreLeagues = true;

		while (hasMoreLeagues) {
			const { data: leagueData } = await getAllLeagues({
				query: {
					association: associationUuid,
					page: leaguePage,
					size: 100,
				},
			});

			if (leagueData?.content) {
				// Filter by current season
				const currentSeasonLeagues = leagueData.content.filter((l) => l.seasonUuid === currentSeason.uuid);
				allLeagues.push(...currentSeasonLeagues);
				leaguePage++;
			}

			if (leagueData?.last === true) {
				hasMoreLeagues = false;
			}

			await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limiting
		}

		console.log(`Found ${allLeagues.length} leagues for current season`);
		Sentry.addBreadcrumb({ category: "sync", message: `Found ${allLeagues.length} leagues for current season`, level: "info", data: { leaguesFound: allLeagues.length } });
		Sentry.setMeasurement("sams_teams_sync.leagues_found", allLeagues.length, "none");

		// Step 4: Get teams from each league
		const allTeams = [];
		for (const league of allLeagues) {
			if (!league.uuid) continue;

			console.log(`Fetching teams for league: ${league.name}...`);
			let teamPage = 0;
			let hasMoreTeams = true;

			while (hasMoreTeams) {
				const { data: teamData } = await getTeamsForLeague({
					path: { uuid: league.uuid },
					query: { page: teamPage, size: 100 },
				});

				if (teamData?.content) {
					// Filter: only our club's teams, no sub-teams (masterTeamUuid)
					// Transform using Zod schema to strip undefined values
					const ourTeams = teamData.content
						.filter((t) => !t.masterTeamUuid)
						.filter((t) => t.sportsclubUuid === sportsclubUuid)
						.map((t) =>
							TeamItemSchema.parse({
								type: "team",
								uuid: t.uuid,
								name: t.name,
								nameSlug: slugify(t.name || ""),
								sportsclubUuid: t.sportsclubUuid,
								associationUuid: t.associationUuid,
								leagueUuid: league.uuid,
								leagueName: league.name,
								seasonUuid: currentSeason.uuid,
								seasonName: currentSeason.name,
								updatedAt: new Date().toISOString(),
								ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365, // 1 year TTL
							}),
						);

					allTeams.push(...ourTeams);
					teamPage++;
				}
				if (teamData?.last === true) {
					hasMoreTeams = false;
				}

				await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limiting
			}
		}

		console.log(`Found ${allTeams.length} teams for VC Müllheim`);
		Sentry.addBreadcrumb({ category: "sync", message: `Found ${allTeams.length} teams for VC Müllheim`, level: "info", data: { teamsFound: allTeams.length } });
		Sentry.setMeasurement("sams_teams_sync.teams_found", allTeams.length, "none");

		// Step 5: Store teams in DynamoDB
		let teamsProcessed = 0;

		for (const team of allTeams) {
			await docClient.send(
				new PutCommand({
					TableName: TEAMS_TABLE_NAME,
					Item: team,
				}),
			);
			teamsProcessed++;
		} // Step 6: Delete stale teams (not updated in this sync)
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		const staleScan = await docClient.send(
			new ScanCommand({
				TableName: TEAMS_TABLE_NAME,
				FilterExpression: "updatedAt < :threshold",
				ExpressionAttributeValues: {
					":threshold": oneHourAgo,
				},
			}),
		);

		let teamsDeleted = 0;
		for (const staleTeam of staleScan.Items || []) {
			await docClient.send(
				new DeleteCommand({
					TableName: TEAMS_TABLE_NAME,
					Key: { uuid: staleTeam.uuid },
				}),
			);
			console.log(`Deleted stale team: ${staleTeam.name}`);
			teamsDeleted++;
		}

		const result = {
			success: true,
			teamsProcessed,
			teamsDeleted,
			timestamp: new Date().toISOString(),
		};

		console.log("Teams sync completed:", result);
		Sentry.setMeasurement("sams_teams_sync.teams_processed", teamsProcessed, "none");
		Sentry.setMeasurement("sams_teams_sync.teams_deleted", teamsDeleted, "none");
		Sentry.addBreadcrumb({ category: "sync", message: "Teams sync completed", level: "info", data: result });

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(result),
		};
	} catch (error) {
		console.error("Error syncing teams:", error);
		Sentry.captureException(error);
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
