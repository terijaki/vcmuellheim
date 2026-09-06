import type { LeagueRankingEntry, Match } from "sams-provider-events";
import {
  samsProjectionMatchSchema,
  type SamsProjectionMatchInput,
  type SamsProjectionRankingEntryInput,
} from "@/lib/db/schemas";

export function mapProviderMatchToProjection(match: Match): SamsProjectionMatchInput {
  return samsProjectionMatchSchema.parse(match);
}

export function mapProviderRankingEntry(
  entry: LeagueRankingEntry,
): SamsProjectionRankingEntryInput {
  return {
    uuid: entry.teamUuid,
    teamName: entry.teamName,
    rank: entry.rank,
    ...(entry.sportsclubUuid ? { sportsclubUuid: entry.sportsclubUuid } : {}),
    ...(entry.logoUrl ? { logoUrl: entry.logoUrl } : {}),
    matchesPlayed: entry.matchesPlayed,
    points: entry.points,
    wins: entry.wins,
    setWins: entry.setWins,
    setLosses: entry.setLosses,
  };
}

export function collectSportsclubUuidsFromMatches(matches: Match[]): string[] {
  const uuids = new Set<string>();
  for (const match of matches) {
    if (match.team1.sportsclubUuid) uuids.add(match.team1.sportsclubUuid);
    if (match.team2.sportsclubUuid) uuids.add(match.team2.sportsclubUuid);
  }
  return [...uuids];
}
