/**
 * SAMS teams sync — orchestrates club resolution, live season fetch, league/team/roster
 * pagination, DynamoDB upserts, and stale record deletion.
 *
 * Sync writes **live** currentSeason to team records; match loading reads that synced
 * seasonUuid — see docs/adr/0001-sams-match-loading.md.
 */

import {
  getAllLeagueHierarchies,
  getAllLeagues,
  getAllSeasons,
  getTeamRosterByTeamUuid,
  getTeamsForLeague,
} from "@codegen/sams/generated";
import { slugify } from "@utils/slugify";
import dayjs from "dayjs";
import type { createSamsDb } from "@/lib/db/electrodb-client";
import {
  filterConfiguredSamsClubs,
  findMissingConfiguredClubSlugs,
  type SamsClubRecord,
} from "@/lib/sams/club-resolution";
import { mapRosterOfficials, mapRosterPlayers } from "@/lib/sams/roster-mapping";

type SamsDb = ReturnType<typeof createSamsDb>;

export type SyncedTeamItem = {
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

export type SyncedRosterItem = {
  teamUuid: string;
  type: "roster";
  players: ReturnType<typeof mapRosterPlayers>;
  officials: ReturnType<typeof mapRosterOfficials>;
  updatedAt: string;
  ttl: number;
};

export type TeamsSyncResult = {
  success: true;
  teamsProcessed: number;
  teamsDeleted: number;
  rostersProcessed: number;
  rostersFailed: number;
  timestamp: string;
};

export type TeamsSyncLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

export type TeamsSyncContext = {
  samsEntities: SamsDb;
  logger: TeamsSyncLogger;
  rateLimitMs?: number;
  onTeamsFound?: (count: number, byClub: Record<string, number>) => void;
  onComplete?: (result: TeamsSyncResult) => void;
  captureRosterError?: (error: unknown, team: SyncedTeamItem) => void;
};

const DEFAULT_RATE_LIMIT_MS = 500;
const TEAM_TTL_SECONDS = 60 * 60 * 24 * 365;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

type SamsLeagueDto = {
  uuid?: string;
  name?: string | null;
  seasonUuid?: string;
  leagueHierarchyUuid?: string;
};

type SamsTeamDto = {
  masterTeamUuid?: string | null;
  sportsclubUuid?: string | null;
  uuid?: string;
  name?: string | null;
  associationUuid?: string | null;
};

function isCurrentSeasonLeague(
  league: SamsLeagueDto,
  seasonUuid: string,
): league is SamsLeagueDto & { uuid: string; name: string } {
  return league.seasonUuid === seasonUuid && !!league.uuid && !!league.name;
}

function isSyncableTeam(
  team: SamsTeamDto,
  sportsclubUuids: Set<string>,
): team is SamsTeamDto & {
  uuid: string;
  name: string;
  sportsclubUuid: string;
  associationUuid: string;
} {
  return (
    !team.masterTeamUuid &&
    !!team.sportsclubUuid &&
    sportsclubUuids.has(team.sportsclubUuid) &&
    !!team.uuid &&
    !!team.name &&
    !!team.associationUuid
  );
}

export function buildSyncedTeamItem(
  team: SamsTeamDto & {
    uuid: string;
    name: string;
    sportsclubUuid: string;
    associationUuid: string;
  },
  league: { uuid: string; name: string; leagueHierarchyUuid?: string },
  season: { uuid: string; name: string },
  hierarchyLevelByUuid: Map<string, number>,
  nowIso: string,
  ttl: number,
): SyncedTeamItem {
  const leagueHierarchyLevel = league.leagueHierarchyUuid
    ? hierarchyLevelByUuid.get(league.leagueHierarchyUuid)
    : undefined;

  return {
    uuid: team.uuid,
    type: "team",
    name: team.name,
    nameSlug: slugify(team.name),
    sportsclubUuid: team.sportsclubUuid,
    associationUuid: team.associationUuid,
    leagueUuid: league.uuid,
    leagueName: league.name,
    ...(leagueHierarchyLevel !== undefined ? { leagueHierarchyLevel } : {}),
    seasonUuid: season.uuid,
    seasonName: season.name,
    updatedAt: nowIso,
    ttl,
  };
}

export async function resolveConfiguredSamsClubsFromStorage(
  samsEntities: SamsDb,
  logger: TeamsSyncLogger,
): Promise<SamsClubRecord[]> {
  const clubResponse = await samsEntities.club.query.byType({ type: "club" }).go({ pages: "all" });
  const missingClubSlugs = findMissingConfiguredClubSlugs(clubResponse.data);

  if (missingClubSlugs.length > 0) {
    logger.warn("Failed to resolve configured SAMS clubs", { missingClubSlugs });
  }

  return filterConfiguredSamsClubs(clubResponse.data);
}

export async function fetchCurrentSeasonUuid(): Promise<{ uuid: string; name: string }> {
  const { data: seasons } = await getAllSeasons({});
  const currentSeason = seasons?.find((s) => s.currentSeason);
  if (!currentSeason?.uuid || !currentSeason.name) {
    throw new Error("Current season not found or missing uuid/name");
  }
  return { uuid: currentSeason.uuid, name: currentSeason.name };
}

async function fetchLeaguesForAssociations(
  associationUuids: string[],
  seasonUuid: string,
  rateLimitMs: number,
): Promise<{
  leagues: Array<{ uuid: string; name: string; seasonUuid?: string; leagueHierarchyUuid?: string }>;
  hierarchyLevelByUuid: Map<string, number>;
}> {
  const allLeagues: Array<{
    uuid: string;
    name: string;
    seasonUuid?: string;
    leagueHierarchyUuid?: string;
  }> = [];
  const hierarchyLevelByUuid = new Map<string, number>();

  for (const associationUuid of associationUuids) {
    let hierarchyPage = 0;
    let hasMoreHierarchies = true;
    while (hasMoreHierarchies) {
      const { data: hierarchyData } = await getAllLeagueHierarchies({
        query: {
          association: associationUuid,
          "for-season": seasonUuid,
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
        const currentSeasonLeagues = leagueData.content.filter((league) =>
          isCurrentSeasonLeague(league, seasonUuid),
        );
        allLeagues.push(...currentSeasonLeagues);
        leaguePage++;
      }

      if (leagueData?.last === true) {
        hasMoreLeagues = false;
      }

      await delay(rateLimitMs);
    }
  }

  return { leagues: allLeagues, hierarchyLevelByUuid };
}

async function fetchTeamsForLeagues(
  leagues: Array<{ uuid: string; name: string; leagueHierarchyUuid?: string }>,
  sportsclubUuids: Set<string>,
  season: { uuid: string; name: string },
  hierarchyLevelByUuid: Map<string, number>,
  rateLimitMs: number,
): Promise<SyncedTeamItem[]> {
  const allTeams: SyncedTeamItem[] = [];
  const nowIso = dayjs().toISOString();
  const ttl = dayjs().unix() + TEAM_TTL_SECONDS;

  for (const league of leagues) {
    let teamPage = 0;
    let hasMoreTeams = true;

    while (hasMoreTeams) {
      const { data: teamData } = await getTeamsForLeague({
        path: { uuid: league.uuid },
        query: { page: teamPage, size: 100 },
      });

      if (teamData?.content) {
        const ourTeams = teamData.content
          .filter((team) => isSyncableTeam(team, sportsclubUuids))
          .map((team) =>
            buildSyncedTeamItem(team, league, season, hierarchyLevelByUuid, nowIso, ttl),
          );

        allTeams.push(...ourTeams);
        teamPage++;
      }

      if (teamData?.last === true) {
        hasMoreTeams = false;
      }

      await delay(rateLimitMs);
    }
  }

  return allTeams;
}

async function upsertTeamsAndRosters(
  samsEntities: SamsDb,
  teams: SyncedTeamItem[],
  rateLimitMs: number,
  captureRosterError?: (error: unknown, team: SyncedTeamItem) => void,
): Promise<{ rostersProcessed: number; rostersFailed: number }> {
  let rostersProcessed = 0;
  let rostersFailed = 0;

  for (const team of teams) {
    await samsEntities.team.upsert(team).go();

    try {
      const { data: rosterData, error: rosterError } = await getTeamRosterByTeamUuid({
        path: { uuid: team.uuid },
      });
      if (rosterError) {
        throw rosterError;
      }
      if (rosterData) {
        const rosterItem: SyncedRosterItem = {
          teamUuid: team.uuid,
          type: "roster",
          players: mapRosterPlayers(team.uuid, rosterData.players),
          officials: mapRosterOfficials(team.uuid, rosterData.officials),
          updatedAt: dayjs().toISOString(),
          ttl: dayjs().unix() + TEAM_TTL_SECONDS,
        };
        await samsEntities.roster.upsert(rosterItem).go();
        rostersProcessed++;
      }
    } catch (error) {
      captureRosterError?.(error, team);
      await samsEntities.roster
        .delete({ teamUuid: team.uuid })
        .go()
        .catch(() => undefined);
      rostersFailed++;
    }

    await delay(rateLimitMs);
  }

  return { rostersProcessed, rostersFailed };
}

async function deleteStaleTeams(samsEntities: SamsDb): Promise<number> {
  const oneHourAgo = dayjs().subtract(1, "hour").toISOString();
  const existingResponse = await samsEntities.team.query
    .byType({ type: "team" })
    .go({ pages: "all" });
  let teamsDeleted = 0;

  for (const existingTeam of existingResponse.data) {
    if (existingTeam.updatedAt < oneHourAgo) {
      await samsEntities.team.delete({ uuid: existingTeam.uuid }).go();
      await samsEntities.roster.delete({ teamUuid: existingTeam.uuid }).go();
      teamsDeleted++;
    }
  }

  return teamsDeleted;
}

export async function runSamsTeamsSync(ctx: TeamsSyncContext): Promise<TeamsSyncResult> {
  const { samsEntities, logger } = ctx;
  const rateLimitMs = ctx.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;

  const clubs = await resolveConfiguredSamsClubsFromStorage(samsEntities, logger);
  if (clubs.length === 0) {
    throw new Error("No configured SAMS clubs found in DynamoDB");
  }

  const sportsclubUuids = new Set(
    clubs.flatMap((club) => (club.sportsclubUuid ? [club.sportsclubUuid] : [])),
  );
  const associationUuids = [
    ...new Set(clubs.flatMap((club) => (club.associationUuid ? [club.associationUuid] : []))),
  ];

  if (associationUuids.length === 0) {
    throw new Error("Configured SAMS clubs have no associationUuid — cannot fetch leagues");
  }

  const currentSeason = await fetchCurrentSeasonUuid();
  const { leagues, hierarchyLevelByUuid } = await fetchLeaguesForAssociations(
    associationUuids,
    currentSeason.uuid,
    rateLimitMs,
  );

  const allTeams = await fetchTeamsForLeagues(
    leagues,
    sportsclubUuids,
    currentSeason,
    hierarchyLevelByUuid,
    rateLimitMs,
  );

  const teamsBySportsclubUuid = Object.fromEntries(
    [...sportsclubUuids].map((sportsclubUuid) => [
      sportsclubUuid,
      allTeams.filter((team) => team.sportsclubUuid === sportsclubUuid).length,
    ]),
  );
  ctx.onTeamsFound?.(allTeams.length, teamsBySportsclubUuid);

  const { rostersProcessed, rostersFailed } = await upsertTeamsAndRosters(
    samsEntities,
    allTeams,
    rateLimitMs,
    ctx.captureRosterError,
  );

  const teamsDeleted = await deleteStaleTeams(samsEntities);

  const result: TeamsSyncResult = {
    success: true,
    teamsProcessed: allTeams.length,
    teamsDeleted,
    rostersProcessed,
    rostersFailed,
    timestamp: dayjs().toISOString(),
  };

  ctx.onComplete?.(result);
  return result;
}
