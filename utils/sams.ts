import { SAMS } from "@project.config";
import { slugify } from "./slugify";

type NullableString = string | null | undefined;

type ClubLike = {
  nameSlug?: NullableString;
  name?: NullableString;
  sportsclubUuid?: NullableString;
};

type TeamLike = {
  uuid?: NullableString;
  sportsclubUuid?: NullableString;
  seasonUuid?: NullableString;
  updatedAt?: NullableString;
};

type MatchLike = {
  uuid?: NullableString;
};

export const SAMS_TARGET_CLUB_NAMES = SAMS.targetClubs.map(({ name }) => name);

export const SAMS_TARGET_CLUB_SLUGS = SAMS_TARGET_CLUB_NAMES.map((name) => slugify(name));

const samsTargetClubSlugSet = new Set<string>(SAMS_TARGET_CLUB_SLUGS);

export function isConfiguredSamsClubSlug(nameSlug: NullableString): boolean {
  return !!nameSlug && samsTargetClubSlugSet.has(nameSlug);
}

/** True when the sportsclub UUID is in the resolved configured-club set. */
export function isConfiguredSportsclubUuid(
  sportsclubUuid: string | undefined,
  configuredSportsclubUuids: ReadonlySet<string>,
): boolean {
  return !!sportsclubUuid && configuredSportsclubUuids.has(sportsclubUuid);
}

type MatchSidesLike = {
  team1: { sportsclubUuid?: string };
  team2: { sportsclubUuid?: string };
};

/** True when either match side belongs to a configured sportsclub. */
export function matchInvolvesConfiguredSportsclub(
  match: MatchSidesLike,
  configuredSportsclubUuids: ReadonlySet<string>,
): boolean {
  return (
    isConfiguredSportsclubUuid(match.team1.sportsclubUuid, configuredSportsclubUuids) ||
    isConfiguredSportsclubUuid(match.team2.sportsclubUuid, configuredSportsclubUuids)
  );
}

export function resolveSamsClubSlug(club: ClubLike): string | undefined {
  if (club.nameSlug) return club.nameSlug;
  if (club.name) return slugify(club.name);
  return undefined;
}

export function resolveConfiguredSamsSportsclubUuids<T extends ClubLike>(
  clubs: readonly T[],
): string[] {
  const sportsclubUuids = new Set<string>();

  for (const club of clubs) {
    const slug = resolveSamsClubSlug(club);
    if (!club.sportsclubUuid || !isConfiguredSamsClubSlug(slug)) continue;
    sportsclubUuids.add(club.sportsclubUuid);
  }

  return [...sportsclubUuids].sort((left, right) => left.localeCompare(right));
}

export function shouldResolveDefaultSamsSportsclubs(filters: {
  league?: NullableString;
  sportsclub?: NullableString;
  team?: NullableString;
}): boolean {
  return !filters.league && !filters.sportsclub && !filters.team;
}

export function resolveEffectiveSamsSportsclubUuids(
  input: Pick<
    { league?: NullableString; sportsclub?: NullableString; team?: NullableString },
    "league" | "sportsclub" | "team"
  >,
  defaultSportsclubUuids: readonly string[],
): string[] {
  if (input.sportsclub) return [input.sportsclub];
  if (!shouldResolveDefaultSamsSportsclubs(input)) return [];
  return [...defaultSportsclubUuids];
}

function compareIsoTimestampsDesc(left?: NullableString, right?: NullableString): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return right.localeCompare(left);
}

/** Season UUID from synced teams in DynamoDB (teams sync output), not SAMS live currentSeason. */
export function resolveSyncedSeasonUuidFromTeams<
  T extends Pick<TeamLike, "seasonUuid" | "updatedAt">,
>(
  teams: readonly T[],
  options?: { onDisagreement?: (seasonUuids: readonly string[]) => void },
): string | undefined {
  const teamsWithSeason = teams.filter(
    (team): team is T & { seasonUuid: string } => !!team.seasonUuid,
  );
  if (teamsWithSeason.length === 0) return undefined;

  const counts = new Map<string, number>();
  for (const team of teamsWithSeason) {
    counts.set(team.seasonUuid, (counts.get(team.seasonUuid) ?? 0) + 1);
  }

  const distinctSeasons = [...counts.keys()];
  if (distinctSeasons.length > 1) {
    options?.onDisagreement?.(distinctSeasons);
  }

  const maxCount = Math.max(...counts.values());
  const topSeasons = new Set(
    [...counts.entries()].filter(([, count]) => count === maxCount).map(([uuid]) => uuid),
  );

  const candidates = teamsWithSeason.filter((team) => topSeasons.has(team.seasonUuid));
  candidates.sort((left, right) => compareIsoTimestampsDesc(left.updatedAt, right.updatedAt));

  return candidates[0]?.seasonUuid;
}

export function pickSyncedSeasonUuid<
  T extends Pick<TeamLike, "seasonUuid" | "updatedAt" | "sportsclubUuid">,
>(teams: readonly T[], preferredSportsclubUuids?: readonly string[]): string | undefined {
  if (preferredSportsclubUuids && preferredSportsclubUuids.length > 0) {
    const preferred = new Set(preferredSportsclubUuids);
    const scopedTeams = teams.filter(
      (team) => team.sportsclubUuid && preferred.has(team.sportsclubUuid),
    );
    return resolveSyncedSeasonUuidFromTeams(scopedTeams);
  }
  return resolveSyncedSeasonUuidFromTeams(teams);
}

export function getOwnedSamsTeamUuids<T extends TeamLike>(teams: readonly T[]): Set<string> {
  const teamUuids = new Set<string>();

  for (const team of teams) {
    if (team.uuid) teamUuids.add(team.uuid);
  }

  return teamUuids;
}

export function getOwnedSamsSportsclubUuids<T extends TeamLike>(teams: readonly T[]): Set<string> {
  const sportsclubUuids = new Set<string>();

  for (const team of teams) {
    if (team.sportsclubUuid) sportsclubUuids.add(team.sportsclubUuid);
  }

  return sportsclubUuids;
}

export function dedupeSamsMatchesByUuid<T extends MatchLike>(matches: readonly T[]): T[] {
  const seenUuids = new Set<string>();
  const dedupedMatches: T[] = [];

  for (const match of matches) {
    if (!match.uuid) {
      dedupedMatches.push(match);
      continue;
    }

    if (seenUuids.has(match.uuid)) continue;

    seenUuids.add(match.uuid);
    dedupedMatches.push(match);
  }

  return dedupedMatches;
}
