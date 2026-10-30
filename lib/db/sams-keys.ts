import type { z } from "zod";
import {
  appHeimspieleSchema,
  appTabelleLeagueSchema,
  appTermineMatchSchema,
  samsClubLogoSchema,
  samsClubSchema,
  samsLeagueRankingProjectionSchema,
  samsClubScheduleProjectionSchema,
  samsRosterSchema,
  samsTeamLogoSchema,
  samsTeamSchema,
} from "@/lib/db/schemas";

function mainKeys(entity: string, id: string): { pk: string; sk: string } {
  return { pk: `${entity}#${id}`, sk: entity };
}

export function samsClubMainKeys(sportsclubUuid: string) {
  return mainKeys("samsClub", sportsclubUuid);
}

export function samsClubGsi1(nameSlug: string) {
  return { gsi1pk: "samsClub", gsi1sk: nameSlug };
}

export function samsClubItemFromDomain(item: z.infer<typeof samsClubSchema>) {
  return {
    ...samsClubMainKeys(item.sportsclubUuid),
    ...samsClubGsi1(item.nameSlug),
    ...item,
  };
}

export function samsTeamMainKeys(uuid: string) {
  return mainKeys("samsTeam", uuid);
}

export function samsTeamGsi1(nameSlug: string) {
  return { gsi1pk: "samsTeam", gsi1sk: nameSlug };
}

export function samsTeamItemFromDomain(item: z.infer<typeof samsTeamSchema>) {
  return {
    ...samsTeamMainKeys(item.uuid),
    ...samsTeamGsi1(item.nameSlug),
    ...item,
  };
}

export function samsRosterMainKeys(teamUuid: string) {
  return mainKeys("samsRoster", teamUuid);
}

export function samsRosterItemFromDomain(item: z.infer<typeof samsRosterSchema>) {
  return { ...samsRosterMainKeys(item.teamUuid), ...item };
}

export function samsScheduleKeys(sportsclubUuid: string, seasonUuid: string) {
  return { pk: `samsSchedule#${sportsclubUuid}`, sk: seasonUuid };
}

export function samsScheduleItemFromDomain(item: z.infer<typeof samsClubScheduleProjectionSchema>) {
  return { ...samsScheduleKeys(item.sportsclubUuid, item.seasonUuid), ...item };
}

export function samsRankingKeys(leagueUuid: string, seasonUuid: string) {
  return { pk: `samsRanking#${leagueUuid}`, sk: seasonUuid };
}

export function samsRankingItemFromDomain(item: z.infer<typeof samsLeagueRankingProjectionSchema>) {
  return { ...samsRankingKeys(item.leagueUuid, item.seasonUuid), ...item };
}

export function samsClubLogoMainKeys(sportsclubUuid: string) {
  return mainKeys("samsClubLogo", sportsclubUuid);
}

export function samsClubLogoItemFromDomain(item: z.infer<typeof samsClubLogoSchema>) {
  return { ...samsClubLogoMainKeys(item.sportsclubUuid), ...item };
}

export function samsTeamLogoMainKeys(teamUuid: string) {
  return mainKeys("samsTeamLogo", teamUuid);
}

export function samsTeamLogoItemFromDomain(item: z.infer<typeof samsTeamLogoSchema>) {
  return { ...samsTeamLogoMainKeys(item.teamUuid), ...item };
}

export function appTabelleKeys(datasetId: string, leagueSortKey: string) {
  return { pk: `appTabelle#${datasetId}`, sk: leagueSortKey };
}

export function appTabelleItemFromDomain(item: z.infer<typeof appTabelleLeagueSchema>) {
  return { ...appTabelleKeys(item.datasetId, item.leagueSortKey), ...item };
}

export function appTermineKeys(datasetId: string, matchSortKey: string) {
  return { pk: `appTermine#${datasetId}`, sk: matchSortKey };
}

export function appTermineItemFromDomain(item: z.infer<typeof appTermineMatchSchema>) {
  return { ...appTermineKeys(item.datasetId, item.matchSortKey), ...item };
}

export function appHeimspieleKeys(datasetId: string, documentKey: string) {
  return { pk: `appHeimspiele#${datasetId}`, sk: documentKey };
}

export function appHeimspieleItemFromDomain(item: z.infer<typeof appHeimspieleSchema>) {
  return { ...appHeimspieleKeys(item.datasetId, item.documentKey), ...item };
}
