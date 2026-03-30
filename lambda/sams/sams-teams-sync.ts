import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { getAllLeagues, getAllSeasons, getTeamsForLeague } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { slugify } from "../../utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { SamsTeamsSyncLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-teams-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsTeamsSyncLambdaEnvironmentSchema);
const TABLE_NAME = env.SAMS_TABLE_NAME;
const samsEntities = createSamsDb(docClient, TABLE_NAME);

const lambdaHandler: APIGatewayProxyHandler = async () => {
	logger.info("Starting SAMS teams sync...");
	Sentry.addBreadcrumb({ category: "sync", message: "Starting SAMS teams sync", level: "info" });
	try {
		// Step 1: Get VC Müllheim club from DynamoDB
		console.log("Fetching VC Müllheim club data...");
		const clubSlug = slugify("VC Müllheim");
		const clubResponse = await samsEntities.club.query.byType({ type: "club" }).begins({ nameSlug: clubSlug }).go({ limit: 1 });
		const club = clubResponse.data[0];
		if (!club) {
			throw new Error("VC Müllheim club not found in DynamoDB");
		}

		const { sportsclubUuid, associationUuid } = club;
		if (!associationUuid) {
			throw new Error(`Club ${club.name} (${sportsclubUuid}) has no associationUuid — cannot fetch leagues`);
		}
		console.log(`Found club: ${club.name} (${sportsclubUuid})`);
		Sentry.addBreadcrumb({ category: "sync", message: `Found club: ${club.name} (${sportsclubUuid})`, level: "info" });

		// Step 2: Get current season
		console.log("Fetching current season...");
		const { data: seasons } = await getAllSeasons({});

		const currentSeason = seasons?.find((s) => s.currentSeason);
		if (!currentSeason) {
			throw new Error("Current season not found");
		}
		if (!currentSeason.uuid || !currentSeason.name) {
			throw new Error("Current season is missing uuid or name");
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
			if (!league.uuid || !league.name) continue;

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
					const ourTeams = teamData.content
						.filter((t) => !t.masterTeamUuid)
						.filter((t) => t.sportsclubUuid === sportsclubUuid)
						.filter((t) => !!t.uuid && !!t.name && !!t.sportsclubUuid && !!t.associationUuid)
						.map((t) => ({
							uuid: t.uuid as string,
							type: "team" as const,
							name: t.name as string,
							nameSlug: slugify(t.name || ""),
							sportsclubUuid: t.sportsclubUuid as string,
							associationUuid: t.associationUuid as string,
							leagueUuid: league.uuid as string,
							leagueName: league.name as string,
							seasonUuid: currentSeason.uuid as string,
							seasonName: currentSeason.name as string,
							updatedAt: new Date().toISOString(),
							ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
						}));

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
			await samsEntities.team.upsert(team).go();
			teamsProcessed++;
		}

		// Step 6: Delete stale teams (not updated in this sync)
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		const existingResponse = await samsEntities.team.query.byType({ type: "team" }).go({ pages: "all" });
		let teamsDeleted = 0;
		for (const existingTeam of existingResponse.data) {
			if (existingTeam.updatedAt < oneHourAgo) {
				await samsEntities.team.delete({ uuid: existingTeam.uuid }).go();
				console.log(`Deleted stale team: ${existingTeam.name}`);
				teamsDeleted++;
			}
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
