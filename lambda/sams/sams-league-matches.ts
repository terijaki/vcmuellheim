import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { getAllLeagueMatches, type LeagueMatchDto } from "@codegen/sams/generated";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import dayjs from "dayjs";
import { createSamsDb } from "@/lib/db/electrodb-client";
import {
  dedupeSamsMatchesByUuid,
  resolveConfiguredSamsSportsclubUuids,
  SAMS_TARGET_CLUB_SLUGS,
  shouldResolveDefaultSamsSportsclubs,
} from "../../utils/sams";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import {
  LeagueMatchesResponseSchema,
  SamsLeagueMatchesLambdaEnvironmentSchema,
  SeasonsResponseSchema,
} from "./types";

const { logger, tracer } = createLambdaResources("sams-league-matches");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsLeagueMatchesLambdaEnvironmentSchema);
const SAMS_API_KEY = env.SAMS_API_KEY;
const TABLE_NAME = env.SAMS_TABLE_NAME;
const samsEntities = createSamsDb(docClient, TABLE_NAME);

async function resolveConfiguredSamsSportsclubUuidsFromStorage(): Promise<string[]> {
  const clubResponse = await samsEntities.club.query.byType({ type: "club" }).go({ pages: "all" });
  const missingClubSlugs = SAMS_TARGET_CLUB_SLUGS.filter(
    (clubSlug) =>
      !clubResponse.data.some((club) => club.nameSlug === clubSlug && !!club.sportsclubUuid),
  );

  if (missingClubSlugs.length > 0) {
    logger.warn("Failed to resolve configured SAMS clubs", { missingClubSlugs });
  }

  return resolveConfiguredSamsSportsclubUuids(clubResponse.data);
}

async function fetchAllLeagueMatchesForSportsclubs({
  league,
  season,
  team,
  sportsclubUuids,
}: {
  league?: string;
  season?: string;
  team?: string;
  sportsclubUuids: readonly string[];
}): Promise<Omit<LeagueMatchDto, "_links">[]> {
  const sportsclubFilters = sportsclubUuids.length > 0 ? sportsclubUuids : [undefined];
  const allMatches: Omit<LeagueMatchDto, "_links">[] = [];

  for (const sportsclubUuid of sportsclubFilters) {
    const defaultQueryParams: Record<string, string> = {};
    if (league) defaultQueryParams["for-league"] = league;
    if (season) defaultQueryParams["for-season"] = season;
    if (sportsclubUuid) defaultQueryParams["for-sportsclub"] = sportsclubUuid;
    if (team) defaultQueryParams["for-team"] = team;

    let currentPage = 0;
    let hasMorePages = true;
    while (hasMorePages) {
      const { data } = await getAllLeagueMatches({
        query: {
          ...defaultQueryParams,
          page: currentPage,
          size: 100,
        },
        headers: {
          "X-API-Key": SAMS_API_KEY,
        },
      });

      if (!data) {
        if (currentPage === 0) throw new Error(`SAMS API returned no data on page ${currentPage}`);
        break;
      }

      if (data.content) {
        const matches = data.content.map(({ _links, ...match }) => match);
        allMatches.push(...matches);
        currentPage++;
      }

      if (data.last === true) {
        hasMorePages = false;
      }
    }
  }

  return dedupeSamsMatchesByUuid(allMatches);
}

const lambdaHandler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  logger.appendKeys({ path: event.path });
  logger.info("Getting SAMS league matches", { pathParameters: event.pathParameters });
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

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    let { league, season, sportsclub, team, limit, range } = queryParams;

    const shouldUseDefaultSportsclubs = shouldResolveDefaultSamsSportsclubs({
      league,
      sportsclub,
      team,
    });
    const defaultSportsclubUuids = shouldUseDefaultSportsclubs
      ? await resolveConfiguredSamsSportsclubUuidsFromStorage()
      : [];
    if (shouldUseDefaultSportsclubs && defaultSportsclubUuids.length === 0) {
      logger.warn("No configured SAMS sportsclub UUIDs resolved; returning empty matches", {
        league,
        season,
      });
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
        body: JSON.stringify(
          LeagueMatchesResponseSchema.parse({
            matches: [],
            timestamp: new Date().toISOString(),
          }),
        ),
      };
    }
    const effectiveSportsclubUuids = sportsclub ? [sportsclub] : defaultSportsclubUuids;

    // Get current season if not specified
    if (!season) {
      try {
        const seasonsResponse = await fetch(`https://${event.requestContext.domainName}/seasons`);
        if (seasonsResponse.ok) {
          const seasonsData = await seasonsResponse.json();
          season = SeasonsResponseSchema.parse(seasonsData).current.uuid;
        }
      } catch (error) {
        console.warn("Failed to fetch current season, proceeding without default:", error);
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            error: "Unable to determine season automatically. Please specify a season.",
          }),
        };
      }
    }

    const allMatches = await fetchAllLeagueMatchesForSportsclubs({
      league,
      season,
      team,
      sportsclubUuids: effectiveSportsclubUuids,
    });

    // Filter matches based on range
    let filteredMatches = allMatches;
    if (range === "future") {
      // Filter by matches without a winner (not yet played)
      filteredMatches = allMatches.filter((m) => !m.results?.winner);
    } else if (range === "past") {
      // Filter by matches with a winner (already played)
      filteredMatches = allMatches.filter((m) => !!m.results?.winner);
    } // Sort matches by date
    if (range === "future") {
      filteredMatches.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1;
      });
    } else if (range === "past") {
      filteredMatches.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1;
      });
    } // Apply limit if specified
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!Number.isNaN(limitNum)) {
        filteredMatches = filteredMatches.slice(0, limitNum);
      }
    }

    const result = LeagueMatchesResponseSchema.parse({
      matches: filteredMatches,
      timestamp: new Date().toISOString(),
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error("Error fetching league matches:", { error });
    Sentry.captureException(error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

export const handler = Sentry.wrapHandler(
  middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)),
);
