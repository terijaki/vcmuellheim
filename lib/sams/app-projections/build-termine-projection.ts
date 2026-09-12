import type { SamsProjectionMatchInput, AppTermineMatchInput } from "@/lib/db/schemas";
import { matchInvolvesConfiguredSportsclub } from "@/utils/sams";
import { buildTermineMatchSortKey } from "./sort-keys";

export type AppTermineMatchRecord = Omit<AppTermineMatchInput, "type"> & {
  type: "apptermine";
};

export function buildTermineProjection(input: {
  datasetId: string;
  updatedAt: string;
  ttl: number;
  configuredSportsclubUuids: ReadonlySet<string>;
  ownedTeamUuids: ReadonlySet<string>;
  leagueNameByUuid: ReadonlyMap<string, string>;
  matches: readonly SamsProjectionMatchInput[];
}): AppTermineMatchRecord[] {
  const byUuid = new Map<string, AppTermineMatchRecord>();

  for (const match of input.matches) {
    if (!matchInvolvesConfiguredSportsclub(match, input.configuredSportsclubUuids)) {
      continue;
    }

    const ownedInMatch = [match.team1.uuid, match.team2.uuid]
      .filter((uuid) => input.ownedTeamUuids.has(uuid))
      .sort((a, b) => a.localeCompare(b));

    const isHomeGame = input.ownedTeamUuids.has(match.team1.uuid);
    const leagueName =
      (match.leagueUuid ? input.leagueNameByUuid.get(match.leagueUuid) : undefined) ?? undefined;

    byUuid.set(match.uuid, {
      datasetId: input.datasetId,
      matchSortKey: buildTermineMatchSortKey(match.hasResult, match.date, match.uuid),
      type: "apptermine",
      matchUuid: match.uuid,
      ...(match.date ? { date: match.date } : {}),
      ...(match.time ? { time: match.time } : {}),
      ...(match.leagueUuid ? { leagueUuid: match.leagueUuid } : {}),
      ...(leagueName ? { leagueName } : {}),
      ...(match.seasonUuid ? { seasonUuid: match.seasonUuid } : {}),
      team1: match.team1,
      team2: match.team2,
      ...(match.location ? { location: match.location } : {}),
      ...(match.result ? { result: match.result } : {}),
      hasResult: match.hasResult,
      isHomeGame,
      ownedTeamUuids: ownedInMatch,
      updatedAt: input.updatedAt,
      ttl: input.ttl,
    });
  }

  return [...byUuid.values()].sort((left, right) =>
    left.matchSortKey.localeCompare(right.matchSortKey),
  );
}
