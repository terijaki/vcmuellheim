import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { APIGatewayProxyHandler } from "aws-lambda";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { runSamsTeamsSync } from "@/lib/sams/teams-sync-service";
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
    const result = await runSamsTeamsSync({
      samsEntities,
      logger: {
        info: (message, meta) => logger.info(message, meta ?? {}),
        warn: (message, meta) => logger.warn(message, meta ?? {}),
      },
      onTeamsFound: (teamsFound, teamsBySportsclubUuid) => {
        console.log(`Found ${teamsFound} teams for configured SAMS clubs`);
        Sentry.addBreadcrumb({
          category: "sync",
          message: `Found ${teamsFound} teams for configured SAMS clubs`,
          level: "info",
          data: { teamsFound, teamsBySportsclubUuid },
        });
        Sentry.setMeasurement("sams_teams_sync.teams_found", teamsFound, "none");
      },
      captureRosterError: (error, team) => {
        console.warn(`Failed to fetch roster for team ${team.name} (${team.uuid}):`, error);
        Sentry.captureException(error, {
          extra: { teamUuid: team.uuid, teamName: team.name },
        });
      },
      onComplete: (syncResult) => {
        console.log("Teams sync completed:", syncResult);
        Sentry.setMeasurement("sams_teams_sync.teams_processed", syncResult.teamsProcessed, "none");
        Sentry.setMeasurement("sams_teams_sync.teams_deleted", syncResult.teamsDeleted, "none");
        Sentry.setMeasurement(
          "sams_teams_sync.rosters_processed",
          syncResult.rostersProcessed,
          "none",
        );
        Sentry.setMeasurement("sams_teams_sync.rosters_failed", syncResult.rostersFailed, "none");
        Sentry.addBreadcrumb({
          category: "sync",
          message: "Teams sync completed",
          level: "info",
          data: syncResult,
        });
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error syncing teams:", error);
    Sentry.captureException(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
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
