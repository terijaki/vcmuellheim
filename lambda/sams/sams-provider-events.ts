import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { SQSEvent, SQSHandler } from "aws-lambda";
import {
  parseSamsEventFromSqsBody,
  SamsEventType,
  type Match,
  type SamsEvent,
} from "sams-provider-events";
import type { SamsRepositories } from "@/lib/sams/repositories/create-sams-repositories";
import type { SamsScheduleProjectionMeta } from "@/lib/sams/repositories/sams-schedule-projection-repository";
import { createSamsRepositories } from "@/lib/sams/repositories";
import {
  SAMS_CLUB_TTL_DAYS,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";
import { slugify } from "@/utils/slugify";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { uploadClubLogoToS3 } from "./club-logo-upload";
import {
  collectSportsclubUuidsFromMatches,
  mapProviderMatchToProjection,
  mapProviderRankingEntry,
} from "./provider-mappers";
import type { RosterOfficial, RosterPlayer } from "./types";
import { SamsProviderProcessorLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("sams-provider-processor");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(SamsProviderProcessorLambdaEnvironmentSchema);
const TABLE_NAME = env.SAMS_TABLE_NAME;
const MEDIA_BUCKET_NAME = env.MEDIA_BUCKET_NAME;

const RESERVED_EVENT_TYPES = new Set<string>([
  SamsEventType.matchesUpdated,
  SamsEventType.syncCompleted,
  SamsEventType.syncFailed,
]);

function mapRosterPlayers(
  players: Array<{
    uuid: string;
    name: string;
    jerseyNumber?: number;
    position?: string;
    portraitUrl?: string;
  }>,
): RosterPlayer[] {
  return players.map((player) => ({
    uuid: player.uuid,
    name: player.name,
    ...(player.jerseyNumber != null ? { jerseyNumber: player.jerseyNumber } : {}),
    ...(player.position ? { position: player.position } : {}),
    ...(player.portraitUrl ? { portraitImageLink: player.portraitUrl } : {}),
  }));
}

function mapRosterOfficials(
  officials: Array<{ uuid: string; name: string; role?: string }>,
): RosterOfficial[] {
  return officials.map((official) => ({
    uuid: official.uuid,
    name: official.name,
    ...(official.role ? { role: official.role } : {}),
  }));
}

async function shouldSkipProjection(
  repos: SamsRepositories,
  sportsclubUuid: string,
  seasonUuid: string,
  snapshotVersion: string,
): Promise<boolean> {
  const existingSnapshotVersion = await repos.schedules.getSnapshotVersion(
    sportsclubUuid,
    seasonUuid,
  );
  return existingSnapshotVersion === snapshotVersion;
}

async function shouldSkipRanking(
  repos: SamsRepositories,
  leagueUuid: string,
  seasonUuid: string,
  snapshotVersion: string,
): Promise<boolean> {
  const existing = await repos.rankings.get(leagueUuid, seasonUuid);
  return existing?.snapshotVersion === snapshotVersion;
}

async function replaceClubSeasonTeams(
  repos: SamsRepositories,
  event: SamsEvent & { type: typeof SamsEventType.clubSeasonTeamsUpdated },
): Promise<void> {
  const { club, season, teams, projectedAt } = event.payload;
  const sportsclubUuid = club.uuid;
  const seasonUuid = season.uuid;
  const seasonName = season.name;
  const now = projectedAt ?? event.occurredAt;
  const ttl = unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS);

  const existingTeams = await repos.teams.listAll();
  const existingClubSeasonTeam = existingTeams.find(
    (team) => team.sportsclubUuid === sportsclubUuid && team.seasonUuid === seasonUuid,
  );
  if (existingClubSeasonTeam?.snapshotVersion === event.snapshotVersion) {
    logger.info("Skipping unchanged club-season teams projection", {
      sportsclubUuid,
      seasonUuid,
      snapshotVersion: event.snapshotVersion,
    });
    return;
  }
  const teamUuidsInEvent = new Set(teams.map((team) => team.uuid));
  const existingClubTeam = existingTeams.find((team) => team.sportsclubUuid === sportsclubUuid);
  const associationUuid = club.associationUuid ?? existingClubTeam?.associationUuid;
  if (!associationUuid) {
    throw new Error(
      `Missing associationUuid for club ${sportsclubUuid} in club-season-teams event`,
    );
  }

  for (const existingTeam of existingTeams) {
    if (
      existingTeam.sportsclubUuid === sportsclubUuid &&
      !teamUuidsInEvent.has(existingTeam.uuid)
    ) {
      await repos.teams.delete(existingTeam.uuid);
      await repos.rosters.delete(existingTeam.uuid);
    }
  }

  for (const team of teams) {
    await repos.teams.upsert({
      uuid: team.uuid,
      name: team.name,
      nameSlug: team.slug || slugify(team.name),
      sportsclubUuid,
      associationUuid,
      leagueUuid: team.leagueUuid,
      leagueName: team.leagueName,
      ...(team.leagueHierarchyLevel !== undefined
        ? { leagueHierarchyLevel: team.leagueHierarchyLevel }
        : {}),
      seasonUuid,
      seasonName,
      snapshotVersion: event.snapshotVersion,
      updatedAt: now,
      ttl,
    });
  }
}

async function replaceClubSeasonRosters(
  repos: SamsRepositories,
  event: SamsEvent & { type: typeof SamsEventType.clubSeasonRostersUpdated },
): Promise<void> {
  const { rosters, projectedAt } = event.payload;
  const now = projectedAt ?? event.occurredAt;
  const ttl = unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS);

  const firstRoster = rosters[0];
  if (firstRoster) {
    const existing = await repos.rosters.getByTeamUuid(firstRoster.team.uuid);
    if (existing?.snapshotVersion === event.snapshotVersion) {
      logger.info("Skipping unchanged club-season rosters projection", {
        snapshotVersion: event.snapshotVersion,
      });
      return;
    }
  }

  for (const roster of rosters) {
    await repos.rosters.upsert({
      teamUuid: roster.team.uuid,
      players: mapRosterPlayers(roster.players),
      officials: mapRosterOfficials(roster.officials),
      snapshotVersion: event.snapshotVersion,
      updatedAt: now,
      ttl,
    });
  }
}

async function upsertTeamRoster(
  repos: SamsRepositories,
  event: SamsEvent & { type: typeof SamsEventType.teamRosterUpdated },
): Promise<void> {
  const { team, players, officials, projectedAt } = event.payload;
  const now = projectedAt ?? event.occurredAt;
  const ttl = unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS);

  const existingRoster = await repos.rosters.getByTeamUuid(team.uuid);
  if (existingRoster?.snapshotVersion === event.snapshotVersion) {
    logger.info("Skipping unchanged team roster projection", {
      teamUuid: team.uuid,
      snapshotVersion: event.snapshotVersion,
    });
    return;
  }

  await repos.rosters.upsert({
    teamUuid: team.uuid,
    players: mapRosterPlayers(players),
    officials: mapRosterOfficials(officials),
    snapshotVersion: event.snapshotVersion,
    updatedAt: now,
    ttl,
  });
}

async function upsertClub(
  repos: SamsRepositories,
  event: SamsEvent & { type: typeof SamsEventType.clubUpdated },
): Promise<void> {
  const club = event.payload;
  const existing = await repos.clubs.getById(club.uuid);
  if (existing?.snapshotVersion === event.snapshotVersion) {
    logger.info("Skipping unchanged club projection", {
      sportsclubUuid: club.uuid,
      snapshotVersion: event.snapshotVersion,
    });
    return;
  }

  const nameSlug = club.slug || slugify(club.name);
  const slugMatches = await repos.clubs.queryByNameSlugPrefix(nameSlug);
  for (const staleClub of slugMatches) {
    if (staleClub.sportsclubUuid !== club.uuid && staleClub.nameSlug === nameSlug) {
      await repos.clubs.delete(staleClub.sportsclubUuid);
    }
  }

  const now = event.occurredAt;
  const ttl = unixTtlSecondsFromNow(SAMS_CLUB_TTL_DAYS);

  let logoS3Key = existing?.logoS3Key;
  const mediaBucketName = MEDIA_BUCKET_NAME ?? "";
  if (club.logoUrl) {
    const uploaded = await uploadClubLogoToS3(mediaBucketName, club.uuid, club.logoUrl);
    if (uploaded) logoS3Key = uploaded;
  }

  await repos.clubs.upsert({
    sportsclubUuid: club.uuid,
    name: club.name,
    nameSlug: club.slug || slugify(club.name),
    ...(club.associationUuid ? { associationUuid: club.associationUuid } : {}),
    ...(club.associationName ? { associationName: club.associationName } : {}),
    ...(club.logoUrl ? { logoImageLink: club.logoUrl } : {}),
    ...(logoS3Key ? { logoS3Key } : {}),
    snapshotVersion: event.snapshotVersion,
    updatedAt: now,
    ttl,
  });
}

async function replaceClubSchedule(
  repos: SamsRepositories,
  sportsclubUuid: string,
  seasonUuid: string,
  seasonName: string,
  matches: Match[],
  meta: SamsScheduleProjectionMeta,
): Promise<void> {
  if (await shouldSkipProjection(repos, sportsclubUuid, seasonUuid, meta.snapshotVersion)) {
    logger.info("Skipping unchanged club schedule projection", {
      sportsclubUuid,
      seasonUuid,
      snapshotVersion: meta.snapshotVersion,
    });
    return;
  }

  try {
    await repos.schedules.replace({
      sportsclubUuid,
      seasonUuid,
      seasonName,
      matches: matches.map(mapProviderMatchToProjection),
      snapshotVersion: meta.snapshotVersion,
      projectedAt: meta.projectedAt,
      cachedAt: meta.cachedAt,
      isStale: meta.isStale,
      ttl: unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
    });
    logger.info("Replaced club schedule projection", {
      sportsclubUuid,
      seasonUuid,
      matchCount: matches.length,
      snapshotVersion: meta.snapshotVersion,
    });
  } catch (error) {
    logger.error("Failed to replace club schedule projection", {
      sportsclubUuid,
      seasonUuid,
      matchCount: matches.length,
      snapshotVersion: meta.snapshotVersion,
      error,
    });
    throw error;
  }
}

async function mergeMatchBlock(
  repos: SamsRepositories,
  sportsclubUuid: string,
  seasonUuid: string,
  seasonName: string | undefined,
  matches: Match[],
  meta: SamsScheduleProjectionMeta,
): Promise<void> {
  if (await shouldSkipProjection(repos, sportsclubUuid, seasonUuid, meta.snapshotVersion)) {
    logger.info("Skipping unchanged match-block merge", {
      sportsclubUuid,
      seasonUuid,
      snapshotVersion: meta.snapshotVersion,
    });
    return;
  }
  await repos.schedules.mergeMatchesForClub(
    sportsclubUuid,
    seasonUuid,
    seasonName,
    matches.map(mapProviderMatchToProjection),
    meta,
  );
}

export async function processSamsProviderEvent(
  event: SamsEvent,
  repos: SamsRepositories = createSamsRepositories(docClient, TABLE_NAME),
): Promise<void> {
  if (RESERVED_EVENT_TYPES.has(event.type)) {
    logger.info("Ignoring reserved SAMS provider event type", { type: event.type });
    return;
  }

  switch (event.type) {
    case SamsEventType.clubUpdated:
      await upsertClub(repos, event);
      return;

    case SamsEventType.clubSeasonTeamsUpdated:
      await replaceClubSeasonTeams(repos, event);
      return;

    case SamsEventType.clubSeasonRostersUpdated:
      await replaceClubSeasonRosters(repos, event);
      return;

    case SamsEventType.teamRosterUpdated:
      await upsertTeamRoster(repos, event);
      return;

    case SamsEventType.clubMatchScheduleUpdated: {
      const { club, season, matches, projectedAt, cachedAt, isStale } = event.payload;
      await replaceClubSchedule(repos, club.uuid, season.uuid, season.name, matches, {
        snapshotVersion: event.snapshotVersion,
        projectedAt,
        cachedAt,
        isStale,
      });
      return;
    }

    case SamsEventType.matchBlockUpdated: {
      const { matches, cachedAt, isStale } = event.payload;
      const sportsclubUuids = collectSportsclubUuidsFromMatches(matches);
      for (const sportsclubUuid of sportsclubUuids) {
        const clubMatches = matches.filter(
          (match) =>
            match.team1.sportsclubUuid === sportsclubUuid ||
            match.team2.sportsclubUuid === sportsclubUuid,
        );
        const seasonUuid = clubMatches.find((match) => match.seasonUuid)?.seasonUuid;
        if (!seasonUuid) continue;
        await mergeMatchBlock(repos, sportsclubUuid, seasonUuid, undefined, clubMatches, {
          snapshotVersion: event.snapshotVersion,
          cachedAt,
          isStale,
        });
      }
      return;
    }

    case SamsEventType.leagueRankingUpdated: {
      const { leagueUuid, seasonUuid, leagueName, seasonName, entries, cachedAt, isStale } =
        event.payload;
      if (await shouldSkipRanking(repos, leagueUuid, seasonUuid, event.snapshotVersion)) {
        return;
      }
      await repos.rankings.replace({
        leagueUuid,
        seasonUuid,
        seasonName,
        leagueName,
        teams: entries.map(mapProviderRankingEntry),
        snapshotVersion: event.snapshotVersion,
        cachedAt,
        isStale,
        ttl: unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      });
      return;
    }

    case SamsEventType.clubsSyncCompleted:
      await repos.ops.upsert({
        scope: "clubs-sync",
        occurredAt: event.occurredAt,
        payload: { ...event.payload },
      });
      return;

    case SamsEventType.teamsSyncCompleted:
      await repos.ops.upsert({
        scope: "teams-sync",
        occurredAt: event.occurredAt,
        payload: { ...event.payload },
      });
      return;

    default:
      logger.info("Ignoring unknown SAMS provider event type", { type: event.type });
  }
}

export async function processSamsProviderSqsBody(
  body: string,
  repos?: SamsRepositories,
): Promise<void> {
  const event = parseSamsEventFromSqsBody(body);
  await processSamsProviderEvent(event, repos);
}

const lambdaHandler: SQSHandler = async (event: SQSEvent) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processSamsProviderSqsBody(record.body);
    } catch (error) {
      logger.error("Failed to process SAMS provider SQS record", {
        messageId: record.messageId,
        error,
      });
      Sentry.captureException(error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

export const handler = Sentry.wrapHandler(
  middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)),
);
