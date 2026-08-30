/** Constant sort key for all Toolbox-managed entities in single-table design */
export const SK_METADATA = "METADATA";

export const teamPk = (id: string): string => `team#${id}`;
export const memberPk = (id: string): string => `member#${id}`;
export const sponsorPk = (id: string): string => `sponsor#${id}`;
export const locationPk = (id: string): string => `location#${id}`;
export const mediaPk = (id: string): string => `media#${id}`;
export const samsClubPk = (sportsclubUuid: string): string => `club#${sportsclubUuid}`;
export const samsTeamPk = (uuid: string): string => `team#${uuid}`;
export const samsRosterPk = (teamUuid: string): string => `roster#${teamUuid}`;
export const samsSchedulePk = (sportsclubUuid: string): string => `schedule#${sportsclubUuid}`;
export const samsSeasonSk = (seasonUuid: string): string => `season#${seasonUuid}`;
export const samsRankingPk = (leagueUuid: string): string => `ranking#${leagueUuid}`;
export const samsMatchPk = (matchUuid: string): string => `match#${matchUuid}`;
export const samsOpsPk = (scope: string): string => `ops#${scope}`;
