import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import {
  getAllLeagueHierarchies,
  getAllLeagues,
  getAllSeasons,
  getTeamsForLeague,
} from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { slugify } from "../../utils/slugify";
import { resolveConfiguredSamsSportsclubUuids, SAMS_TARGET_CLUB_SLUGS } from "../../utils/sams";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { SamsTeamsSyncLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-teams-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsTeamsSyncLambdaEnvironmentSchema);
const TABLE_NAME = env.SAMS_TABLE_NAME;
const samsEntities = createSamsDb(docClient, TABLE_NAME);

type SyncedTeamItem = {
  uuid: string;
  type: "team";
  name: string;
  nameSlug: string;
  sportsclubUuid: string;
  associationUuid: string;
  leagueUuid: string;
  leagueName: string;
  leagueHierarchyLevel?: number;
  seasonUuid: string;
  seasonName: string;
  updatedAt: string;
  ttl: number;
};

async function resolveConfiguredSamsClubsFromStorage() {
  const clubResponse = await samsEntities.club.query.byType({ type: "club" }).go({ pages: "all" });
  const missingClubSlugs = SAMS_TARGET_CLUB_SLUGS.filter(
    (clubSlug) =>
      !clubResponse.data.some((club) => club.nameSlug === clubSlug && !!club.sportsclubUuid),
  );

  if (missingClubSlugs.length > 0) {
    logger.warn("Failed to resolve configured SAMS clubs", { missingClubSlugs });
  }

  const sportsclubUuids = new Set(resolveConfiguredSamsSportsclubUuids(clubResponse.data));
  return clubResponse.data.filter(
    (club) => club.sportsclubUuid && sportsclubUuids.has(club.sportsclubUuid),
  );
}

const lambdaHandler: APIGatewayProxyHandler = async () => {
  logger.info("Starting SAMS teams sync...");
  Sentry.addBreadcrumb({ category: "sync", message: "Starting SAMS teams sync", level: "info" });
  try {
    // Step 1: Get configured SAMS clubs from DynamoDB
    console.log("Fetching configured SAMS club data...");
    const clubs = await resolveConfiguredSamsClubsFromStorage();
    if (clubs.length === 0) {
      throw new Error("No configured SAMS clubs found in DynamoDB");
    }

    const sportsclubUuids = new Set(clubs.map((club) => club.sportsclubUuid));
    const associationUuids = [
      ...new Set(clubs.flatMap((club) => (club.associationUuid ? [club.associationUuid] : []))),
    ];

    if (associationUuids.length === 0) {
      throw new Error("Configured SAMS clubs have no associationUuid — cannot fetch leagues");
    }

    console.log(
      `Found configured clubs: ${clubs.map((club) => `${club.name} (${club.sportsclubUuid})`).join(", ")}`,
    );
    Sentry.addBreadcrumb({
      category: "sync",
      message: "Found configured SAMS clubs",
      level: "info",
      data: {
        clubs: clubs.map((club) => ({ name: club.name, sportsclubUuid: club.sportsclubUuid })),
      },
    });

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

    // Step 3: Get all leagues for the association filtered by current season.
    // build a hierarchy level map so we can store the level on each team.
    console.log(`Fetching leagues for associations ${associationUuids.join(", ")}...`);
    const allLeagues = [];
    let leaguePage = 0;
    let hasMoreLeagues = true;

    // Build hierarchy level map: hierarchyUuid → level number
    const hierarchyLevelByUuid = new Map<string, number>();
    for (const associationUuid of associationUuids) {
      let hierarchyPage = 0;
      let hasMoreHierarchies = true;
      while (hasMoreHierarchies) {
        const { data: hierarchyData } = await getAllLeagueHierarchies({
          query: {
            association: associationUuid,
            "for-season": currentSeason.uuid,
            page: hierarchyPage,
            size: 100,
          },
        });
        for (const hierarchy of hierarchyData?.content ?? []) {
          if (hierarchy.uuid && hierarchy.level !== undefined) {
            hierarchyLevelByUuid.set(hierarchy.uuid, hierarchy.level);
          }
        }
        hasMoreHierarchies = hierarchyData?.last !== true;
        hierarchyPage++;
      }

      leaguePage = 0;
      hasMoreLeagues = true;
      while (hasMoreLeagues) {
        const { data: leagueData } = await getAllLeagues({
          query: {
            association: associationUuid,
            page: leaguePage,
            size: 100,
          },
        });

        if (leagueData?.content) {
          const currentSeasonLeagues = leagueData.content.filter(
            (league) => league.seasonUuid === currentSeason.uuid,
          );
          allLeagues.push(...currentSeasonLeagues);
          leaguePage++;
        }

        if (leagueData?.last === true) {
          hasMoreLeagues = false;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(`Found ${allLeagues.length} leagues for current season`);
    Sentry.addBreadcrumb({
      category: "sync",
      message: `Found ${allLeagues.length} leagues for current season`,
      level: "info",
      data: { leaguesFound: allLeagues.length },
    });
    Sentry.setMeasurement("sams_teams_sync.leagues_found", allLeagues.length, "none");

    // Step 4: Get teams from each league
    const allTeams: SyncedTeamItem[] = [];
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
          const ourTeams: SyncedTeamItem[] = teamData.content
            .filter((t) => !t.masterTeamUuid)
            .filter((t) => !!t.sportsclubUuid && sportsclubUuids.has(t.sportsclubUuid))
            .filter((t) => !!t.uuid && !!t.name && !!t.sportsclubUuid && !!t.associationUuid)
            .map((t) => {
              const leagueHierarchyLevel = league.leagueHierarchyUuid
                ? hierarchyLevelByUuid.get(league.leagueHierarchyUuid)
                : undefined;

              return {
                uuid: t.uuid as string,
                type: "team" as const,
                name: t.name as string,
                nameSlug: slugify(t.name || ""),
                sportsclubUuid: t.sportsclubUuid as string,
                associationUuid: t.associationUuid as string,
                leagueUuid: league.uuid as string,
                leagueName: league.name as string,
                ...(leagueHierarchyLevel !== undefined ? { leagueHierarchyLevel } : {}),
                seasonUuid: currentSeason.uuid as string,
                seasonName: currentSeason.name as string,
                updatedAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
              };
            });

          allTeams.push(...ourTeams);
          teamPage++;
        }
        if (teamData?.last === true) {
          hasMoreTeams = false;
        }

        await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limiting
      }
    }

    const teamsBySportsclubUuid = Object.fromEntries(
      [...sportsclubUuids].map((sportsclubUuid) => [
        sportsclubUuid,
        allTeams.filter((team) => team.sportsclubUuid === sportsclubUuid).length,
      ]),
    );

    console.log(`Found ${allTeams.length} teams for configured SAMS clubs`);
    Sentry.addBreadcrumb({
      category: "sync",
      message: `Found ${allTeams.length} teams for configured SAMS clubs`,
      level: "info",
      data: { teamsFound: allTeams.length, teamsBySportsclubUuid },
    });
    Sentry.setMeasurement("sams_teams_sync.teams_found", allTeams.length, "none");

    // Step 5: Store teams in DynamoDB
    let teamsProcessed = 0;

    for (const team of allTeams) {
      await samsEntities.team.upsert(team).go();
      teamsProcessed++;
    }

    // Step 6: Delete stale teams (not updated in this sync)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const existingResponse = await samsEntities.team.query
      .byType({ type: "team" })
      .go({ pages: "all" });
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
    Sentry.addBreadcrumb({
      category: "sync",
      message: "Teams sync completed",
      level: "info",
      data: result,
    });

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

export const handler = Sentry.wrapHandler(
  middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)),
);
