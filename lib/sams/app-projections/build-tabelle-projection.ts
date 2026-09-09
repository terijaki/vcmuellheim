import type {
  SamsLeagueRankingProjectionInput,
  SamsProjectionRankingEntryInput,
  SamsTeamInput,
} from "@/lib/db/schemas";
import { padLeagueSortLevel } from "./sort-keys";

export type TabelleTeamSource = Pick<
  SamsTeamInput,
  | "uuid"
  | "sportsclubUuid"
  | "leagueUuid"
  | "leagueName"
  | "leagueHierarchyLevel"
  | "seasonUuid"
  | "seasonName"
>;

export type TabelleRankingSource = Pick<
  SamsLeagueRankingProjectionInput,
  "leagueUuid" | "seasonUuid" | "leagueName" | "seasonName" | "teams"
>;

export type AppTabelleLeagueRecord = {
  datasetId: string;
  leagueSortKey: string;
  type: "apptabelle";
  leagueUuid: string;
  leagueName: string;
  leagueHierarchyLevel?: number;
  seasonUuid: string;
  seasonName?: string;
  teams: SamsProjectionRankingEntryInput[];
  ownedTeamUuids: string[];
  updatedAt: string;
  ttl: number;
};

export function buildTabelleProjection(input: {
  datasetId: string;
  seasonUuid: string;
  seasonName?: string;
  updatedAt: string;
  ttl: number;
  configuredSportsclubUuids: ReadonlySet<string>;
  teams: readonly TabelleTeamSource[];
  rankingsByLeagueUuid: ReadonlyMap<string, TabelleRankingSource>;
}): AppTabelleLeagueRecord[] {
  const ownedTeams = input.teams.filter((team) =>
    input.configuredSportsclubUuids.has(team.sportsclubUuid),
  );

  const leagues = new Map<
    string,
    {
      leagueUuid: string;
      leagueName: string;
      leagueHierarchyLevel?: number;
      ownedTeamUuids: string[];
      firstSeenOrder: number;
    }
  >();

  for (const [index, team] of ownedTeams.entries()) {
    const existing = leagues.get(team.leagueUuid);
    if (existing) {
      if (!existing.ownedTeamUuids.includes(team.uuid)) {
        existing.ownedTeamUuids.push(team.uuid);
      }
      if (existing.leagueHierarchyLevel === undefined && team.leagueHierarchyLevel !== undefined) {
        existing.leagueHierarchyLevel = team.leagueHierarchyLevel;
      }
      continue;
    }
    leagues.set(team.leagueUuid, {
      leagueUuid: team.leagueUuid,
      leagueName: team.leagueName,
      ...(team.leagueHierarchyLevel !== undefined
        ? { leagueHierarchyLevel: team.leagueHierarchyLevel }
        : {}),
      ownedTeamUuids: [team.uuid],
      firstSeenOrder: index,
    });
  }

  const orderedLeagues = [...leagues.values()].sort((left, right) => {
    const levelLeft = left.leagueHierarchyLevel ?? Number.POSITIVE_INFINITY;
    const levelRight = right.leagueHierarchyLevel ?? Number.POSITIVE_INFINITY;
    if (levelLeft !== levelRight) return levelLeft - levelRight;
    const nameCompare = left.leagueName.localeCompare(right.leagueName);
    if (nameCompare !== 0) return nameCompare;
    return left.firstSeenOrder - right.firstSeenOrder;
  });

  const records: AppTabelleLeagueRecord[] = [];
  for (const league of orderedLeagues) {
    const ranking = input.rankingsByLeagueUuid.get(league.leagueUuid);
    if (!ranking) continue;

    records.push({
      datasetId: input.datasetId,
      leagueSortKey: `${padLeagueSortLevel(league.leagueHierarchyLevel)}#${league.leagueUuid}`,
      type: "apptabelle",
      leagueUuid: league.leagueUuid,
      leagueName: ranking.leagueName ?? league.leagueName,
      ...(league.leagueHierarchyLevel !== undefined
        ? { leagueHierarchyLevel: league.leagueHierarchyLevel }
        : {}),
      seasonUuid: input.seasonUuid,
      seasonName: ranking.seasonName ?? input.seasonName,
      teams: ranking.teams,
      ownedTeamUuids: [...league.ownedTeamUuids].sort((a, b) => a.localeCompare(b)),
      updatedAt: input.updatedAt,
      ttl: input.ttl,
    });
  }

  return records;
}
