import dayjs from "dayjs";
import { SamsEventType } from "sams-provider-events";
import {
  matchUuid,
  opponentTeamDisplayName,
  opponentTeamUuid,
  playerUuid,
  SEED_CLUB_TEAMS,
  SEED_OPPONENT_CLUBS,
  SEED_SEASON,
  SEED_TARGET_CLUBS,
  type SeedTargetClub,
} from "./ids";
import { picsumImageUrl } from "./picsum";

export type SamsProviderFixture = {
  type: string;
  payload: Record<string, unknown>;
  snapshotVersion: string;
};

export type BuildSamsProviderSeedFixturesOptions = {
  variationSeed: string;
  now?: Date;
  opponentsPerLeague?: number;
};

type SeedTeam = (typeof SEED_CLUB_TEAMS)[SeedTargetClub["uuid"]][number];

const SNAPSHOT_PREFIX = "seedvcm";

export function hashVariationSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveTargetClubTeamCount(variationSeed: string, clubUuid: string): number {
  return 1 + (hashVariationSeed(`${variationSeed}:${clubUuid}`) % 3);
}

export function resolveMvTeamCount(variationSeed: string): number {
  return resolveTargetClubTeamCount(variationSeed, SEED_TARGET_CLUBS[0].uuid);
}

function snapshotVersion(variationSeed: string, index: number): string {
  const hash = hashVariationSeed(`${variationSeed}:${index}`);
  return `${SNAPSHOT_PREFIX}${hash.toString(16).padStart(8, "0")}`;
}

function clampOpponentsPerLeague(value: number | undefined): number {
  if (value == null) return 8;
  return Math.min(9, Math.max(6, value));
}

function clubLogoUrl(club: SeedTargetClub | (typeof SEED_OPPONENT_CLUBS)[number]): string | null {
  if (!("picsumSeed" in club)) return null;
  return picsumImageUrl(club.picsumSeed, 128, 128);
}

function clubProjection(club: SeedTargetClub | (typeof SEED_OPPONENT_CLUBS)[number]) {
  return {
    uuid: club.uuid,
    name: club.name,
    slug: club.slug,
    associationUuid: SEED_TARGET_CLUBS[0].associationUuid,
    associationName: SEED_TARGET_CLUBS[0].associationName,
    logoUrl: clubLogoUrl(club),
  };
}

function leagueOpponentOffset(leagueUuid: string, variationSeed: string): number {
  return hashVariationSeed(`${variationSeed}:${leagueUuid}`) % SEED_OPPONENT_CLUBS.length;
}

function pickOpponentClub(leagueUuid: string, opponentIndex: number, variationSeed: string) {
  const offset = leagueOpponentOffset(leagueUuid, variationSeed);
  return SEED_OPPONENT_CLUBS[(offset + opponentIndex) % SEED_OPPONENT_CLUBS.length];
}

function rankingStatsForRank(
  rank: number,
  leagueIndex: number,
  leagueUuid: string,
  variationSeed: string,
) {
  const hash = hashVariationSeed(`${variationSeed}:stats:${leagueUuid}:${rank}`);
  const spread = hash % 5;
  const base = 22 - rank * 2 + leagueIndex * 3 + spread;
  const wins = Math.max(0, 9 - rank + leagueIndex + (hash % 3));
  const setWins = base + 2 + (hash % 4);
  const setLosses = rank * 2 + leagueIndex + spread;
  return {
    points: Math.max(0, base),
    wins,
    setWins,
    setLosses,
    matchesPlayed: 5 + (rank % 3) + leagueIndex,
  };
}

function buildOpponentRankingEntries(
  club: SeedTargetClub,
  team: SeedTeam,
  teamRank: number,
  opponentsPerLeague: number,
  leagueIndex: number,
  variationSeed: string,
) {
  const totalEntries = opponentsPerLeague + 1;
  const entries: Array<{
    rank: number;
    teamUuid: string;
    teamName: string;
    sportsclubUuid: string;
    logoUrl?: string;
    points: number;
    wins: number;
    setWins: number;
    setLosses: number;
    matchesPlayed: number;
  }> = [];

  let opponentIndex = 0;
  for (let rank = 1; rank <= totalEntries; rank++) {
    if (rank === teamRank) {
      const stats = rankingStatsForRank(rank, leagueIndex, team.leagueUuid, variationSeed);
      const logoUrl = clubLogoUrl(club);
      entries.push({
        rank,
        teamUuid: team.uuid,
        teamName: team.name,
        sportsclubUuid: club.uuid,
        ...(logoUrl ? { logoUrl } : {}),
        ...stats,
      });
      continue;
    }

    const opponentClub = pickOpponentClub(team.leagueUuid, opponentIndex, variationSeed);
    const teamUuid = opponentTeamUuid(team.leagueUuid, opponentIndex);
    const stats = rankingStatsForRank(
      rank,
      leagueIndex + 1,
      team.leagueUuid,
      `${variationSeed}:opp:${opponentIndex}`,
    );
    const opponentLogoUrl = clubLogoUrl(opponentClub);
    entries.push({
      rank,
      teamUuid,
      teamName: opponentTeamDisplayName(opponentClub, opponentIndex + leagueIndex * 2),
      sportsclubUuid: opponentClub.uuid,
      ...(opponentLogoUrl ? { logoUrl: opponentLogoUrl } : {}),
      ...stats,
    });
    opponentIndex++;
  }

  return entries;
}

function buildMatchesForTeam(
  club: SeedTargetClub,
  team: SeedTeam,
  anchor: dayjs.Dayjs,
  opponentsPerLeague: number,
  variationSeed: string,
) {
  const matches: Array<Record<string, unknown>> = [];
  const displayName = team.name;

  for (let index = 1; index <= 4; index++) {
    const opponentClub = pickOpponentClub(team.leagueUuid, index - 1, variationSeed);
    const opponentTeamUuidValue = opponentTeamUuid(
      team.leagueUuid,
      (index - 1) % opponentsPerLeague,
    );
    const opponentName = opponentTeamDisplayName(opponentClub, index - 1);
    const isHome = index % 2 === 1;
    const clubWon = index % 2 === 1;
    const matchDate = anchor.subtract(index * 7, "day");

    matches.push({
      uuid: matchUuid(team.uuid, "past", index),
      date: matchDate.format("YYYY-MM-DD"),
      time: "19:00",
      leagueUuid: team.leagueUuid,
      seasonUuid: SEED_SEASON.uuid,
      team1: isHome
        ? { uuid: team.uuid, name: displayName, sportsclubUuid: club.uuid }
        : { uuid: opponentTeamUuidValue, name: opponentName, sportsclubUuid: opponentClub.uuid },
      team2: isHome
        ? { uuid: opponentTeamUuidValue, name: opponentName, sportsclubUuid: opponentClub.uuid }
        : { uuid: team.uuid, name: displayName, sportsclubUuid: club.uuid },
      location: {
        uuid: `location-${team.leagueUuid}-${index % 3}`,
        name: `${opponentClub.shortName} Halle ${(index % 3) + 1}`,
      },
      hasResult: true,
      result: {
        winner: clubWon ? team.uuid : opponentTeamUuidValue,
        winnerName: clubWon ? displayName : opponentName,
        setPoints: clubWon ? "3:1" : "1:3",
        ballPoints: clubWon ? `${75 + index}:${60 + index}` : `${60 + index}:${75 + index}`,
        sets: [
          {
            number: 1,
            ballPoints: clubWon ? "25:20" : "20:25",
            winner: clubWon ? team.uuid : opponentTeamUuidValue,
            winnerName: clubWon ? displayName : opponentName,
          },
        ],
      },
    });
  }

  for (let index = 1; index <= 3; index++) {
    const opponentClub = pickOpponentClub(team.leagueUuid, index + 2, variationSeed);
    const opponentTeamUuidValue = opponentTeamUuid(
      team.leagueUuid,
      (index + 2) % opponentsPerLeague,
    );
    const opponentName = opponentTeamDisplayName(opponentClub, index + 2);
    const isHome = index % 2 === 0;
    const matchDate = anchor.add(index * 7, "day");

    matches.push({
      uuid: matchUuid(team.uuid, "future", index),
      date: matchDate.format("YYYY-MM-DD"),
      time: "18:30",
      leagueUuid: team.leagueUuid,
      seasonUuid: SEED_SEASON.uuid,
      team1: isHome
        ? { uuid: team.uuid, name: displayName, sportsclubUuid: club.uuid }
        : { uuid: opponentTeamUuidValue, name: opponentName, sportsclubUuid: opponentClub.uuid },
      team2: isHome
        ? { uuid: opponentTeamUuidValue, name: opponentName, sportsclubUuid: opponentClub.uuid }
        : { uuid: team.uuid, name: displayName, sportsclubUuid: club.uuid },
      location: {
        uuid: `location-future-${team.leagueUuid}-${index % 3}`,
        name: `Arena ${opponentClub.slug} ${(index % 3) + 1}`,
      },
      hasResult: false,
    });
  }

  return matches;
}

function buildRosterForTeam(club: SeedTargetClub, team: SeedTeam) {
  const players = Array.from({ length: 8 }, (_, index) => {
    const jersey = index + 1;
    return {
      uuid: playerUuid(team.uuid, jersey),
      name: `Player ${jersey} (${team.slug})`,
      jerseyNumber: jersey,
      position: index % 2 === 0 ? "OH" : "MB",
      portraitUrl: picsumImageUrl(`player-${team.uuid}-${jersey}`, 200, 200),
    };
  });

  return {
    team: {
      uuid: team.uuid,
      name: team.name,
      slug: team.slug,
      leagueUuid: team.leagueUuid,
      leagueName: team.leagueName,
      leagueHierarchyLevel: team.leagueHierarchyLevel,
      sportsclubUuid: club.uuid,
    },
    players,
    officials: [{ uuid: `official-${team.uuid}-coach`, name: `Coach ${team.slug}`, role: "Coach" }],
  };
}

export function buildSamsProviderSeedFixtures(
  options: BuildSamsProviderSeedFixturesOptions,
): SamsProviderFixture[] {
  const anchor = dayjs(options.now ?? new Date());
  const opponentsPerLeague = clampOpponentsPerLeague(options.opponentsPerLeague);
  const projectedAt = anchor.toISOString();
  const fixtures: SamsProviderFixture[] = [];
  let snapshotIndex = 0;

  for (const club of SEED_TARGET_CLUBS) {
    const teams = SEED_CLUB_TEAMS[club.uuid];
    const teamCount = resolveTargetClubTeamCount(options.variationSeed, club.uuid);
    const activeTeams = teams.slice(0, teamCount);

    fixtures.push({
      type: SamsEventType.clubUpdated,
      payload: clubProjection(club),
      snapshotVersion: snapshotVersion(options.variationSeed, snapshotIndex++),
    });

    fixtures.push({
      type: SamsEventType.clubSeasonTeamsUpdated,
      payload: {
        club: clubProjection(club),
        season: { ...SEED_SEASON, current: true },
        teams: activeTeams.map((team) => ({
          uuid: team.uuid,
          name: team.name,
          slug: team.slug,
          leagueUuid: team.leagueUuid,
          leagueName: team.leagueName,
          leagueHierarchyLevel: team.leagueHierarchyLevel,
        })),
        projectedAt,
      },
      snapshotVersion: snapshotVersion(options.variationSeed, snapshotIndex++),
    });

    fixtures.push({
      type: SamsEventType.clubSeasonRostersUpdated,
      payload: {
        club: clubProjection(club),
        season: { ...SEED_SEASON, current: true },
        rosters: activeTeams.map((team) => buildRosterForTeam(club, team)),
        projectedAt,
        cachedAt: projectedAt,
        isStale: false,
      },
      snapshotVersion: snapshotVersion(options.variationSeed, snapshotIndex++),
    });

    fixtures.push({
      type: SamsEventType.clubMatchScheduleUpdated,
      payload: {
        club: clubProjection(club),
        season: { ...SEED_SEASON, current: true },
        matches: activeTeams.flatMap((team) =>
          buildMatchesForTeam(club, team, anchor, opponentsPerLeague, options.variationSeed),
        ),
        projectedAt,
        cachedAt: projectedAt,
        isStale: false,
      },
      snapshotVersion: snapshotVersion(options.variationSeed, snapshotIndex++),
    });

    for (const [teamIndex, team] of activeTeams.entries()) {
      fixtures.push({
        type: SamsEventType.leagueRankingUpdated,
        payload: {
          leagueUuid: team.leagueUuid,
          leagueName: team.leagueName,
          seasonUuid: SEED_SEASON.uuid,
          seasonName: SEED_SEASON.name,
          cachedAt: projectedAt,
          refreshState: "active",
          nextRefreshAfter: null,
          isStale: false,
          sourceMatchBlockId: `block-${team.leagueUuid}`,
          entries: buildOpponentRankingEntries(
            club,
            team,
            teamIndex + 2,
            opponentsPerLeague,
            teamIndex,
            options.variationSeed,
          ),
        },
        snapshotVersion: snapshotVersion(options.variationSeed, snapshotIndex++),
      });
    }
  }

  for (const opponentClub of SEED_OPPONENT_CLUBS) {
    fixtures.push({
      type: SamsEventType.clubUpdated,
      payload: clubProjection(opponentClub),
      snapshotVersion: snapshotVersion(options.variationSeed, snapshotIndex++),
    });
  }

  return fixtures;
}

export const TEST_VARIATION_SEED = "test-fixture-seed";

export function buildTestSamsProviderFixtures(): SamsProviderFixture[] {
  return buildSamsProviderSeedFixtures({
    variationSeed: TEST_VARIATION_SEED,
    now: new Date("2026-08-27T12:00:00.000Z"),
    opponentsPerLeague: 6,
  });
}
