import type { SamsRepositories } from "@/lib/sams/repositories/create-sams-repositories";
import {
  isoTimestampNow,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";
import {
  getOwnedSamsTeamUuids,
  resolveConfiguredSamsSportsclubUuids,
  resolveSyncedSeasonUuidFromTeams,
} from "@/utils/sams";
import { buildTabelleProjection } from "./build-tabelle-projection";
import { buildTermineProjection } from "./build-termine-projection";
import { APP_DATASET_CURRENT, seasonDatasetId } from "./sort-keys";

export type RebuildAppProjectionsResult = {
  seasonUuid: string | null;
  tabelleLeagueCount: number;
  termineMatchCount: number;
};

/**
 * Rebuild application Tabelle/Termine read models from canonical SAMS projections.
 * Writes both the `current` dataset and a season-keyed historical copy.
 */
export async function rebuildAppProjections(
  repos: SamsRepositories,
): Promise<RebuildAppProjectionsResult> {
  const [clubs, teams] = await Promise.all([repos.clubs.listAll(), repos.teams.listAll()]);
  const configuredSportsclubUuids = new Set(resolveConfiguredSamsSportsclubUuids(clubs));
  const seasonUuid = resolveSyncedSeasonUuidFromTeams(teams);

  if (!seasonUuid || configuredSportsclubUuids.size === 0) {
    await Promise.all([
      repos.appTabelle.replaceDataset(APP_DATASET_CURRENT, []),
      repos.appTermine.replaceDataset(APP_DATASET_CURRENT, []),
    ]);
    return { seasonUuid: seasonUuid ?? null, tabelleLeagueCount: 0, termineMatchCount: 0 };
  }

  const seasonTeams = teams.filter((team) => team.seasonUuid === seasonUuid);
  const ownedSeasonTeams = seasonTeams.filter((team) =>
    configuredSportsclubUuids.has(team.sportsclubUuid),
  );
  const ownedTeamUuids = getOwnedSamsTeamUuids(ownedSeasonTeams);
  const seasonName = seasonTeams.find((team) => team.seasonName)?.seasonName;
  const leagueUuids = [...new Set(ownedSeasonTeams.map((team) => team.leagueUuid).filter(Boolean))];

  const rankings = await Promise.all(
    leagueUuids.map((leagueUuid) => repos.rankings.get(leagueUuid, seasonUuid)),
  );
  const rankingsByLeagueUuid = new Map(
    rankings
      .filter((ranking): ranking is NonNullable<typeof ranking> => ranking !== null)
      .map((ranking) => [ranking.leagueUuid, ranking]),
  );

  const sportsclubUuids = [...configuredSportsclubUuids];
  const matches = await repos.schedules.listMatchesForSportsclubs(sportsclubUuids, seasonUuid);

  const leagueNameByUuid = new Map<string, string>();
  for (const team of ownedSeasonTeams) {
    if (team.leagueUuid && team.leagueName) {
      leagueNameByUuid.set(team.leagueUuid, team.leagueName);
    }
  }

  const updatedAt = isoTimestampNow();
  const ttl = unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS);

  const tabelleLeagues = buildTabelleProjection({
    datasetId: APP_DATASET_CURRENT,
    seasonUuid,
    seasonName,
    updatedAt,
    ttl,
    configuredSportsclubUuids,
    teams: seasonTeams,
    rankingsByLeagueUuid,
  });

  const termineMatches = buildTermineProjection({
    datasetId: APP_DATASET_CURRENT,
    updatedAt,
    ttl,
    configuredSportsclubUuids,
    ownedTeamUuids,
    leagueNameByUuid,
    matches,
  });

  const historicalDatasetId = seasonDatasetId(seasonUuid);
  const historicalTabelle = tabelleLeagues.map((league) => ({
    ...league,
    datasetId: historicalDatasetId,
  }));
  const historicalTermine = termineMatches.map((match) => ({
    ...match,
    datasetId: historicalDatasetId,
  }));

  await Promise.all([
    repos.appTabelle.replaceDataset(APP_DATASET_CURRENT, tabelleLeagues),
    repos.appTabelle.replaceDataset(historicalDatasetId, historicalTabelle),
    repos.appTermine.replaceDataset(APP_DATASET_CURRENT, termineMatches),
    repos.appTermine.replaceDataset(historicalDatasetId, historicalTermine),
  ]);

  return {
    seasonUuid,
    tabelleLeagueCount: tabelleLeagues.length,
    termineMatchCount: termineMatches.length,
  };
}
