/**
 * Detect matches that newly acquired an official SAMS result (hasResult false → true).
 */

export type MatchConclusionTeam = {
  sportsclubUuid?: string;
};

export type MatchForConclusion = {
  uuid: string;
  hasResult: boolean;
  team1: MatchConclusionTeam;
  team2: MatchConclusionTeam;
};

function involvesConfiguredClub(
  match: MatchForConclusion,
  configuredSportsclubUuids: ReadonlySet<string>,
): boolean {
  const team1Club = match.team1.sportsclubUuid;
  const team2Club = match.team2.sportsclubUuid;
  return (
    (!!team1Club && configuredSportsclubUuids.has(team1Club)) ||
    (!!team2Club && configuredSportsclubUuids.has(team2Club))
  );
}

/**
 * Returns incoming matches that transitioned to hasResult === true for a previously
 * stored UUID, involve a configured club, and are unique by match UUID.
 *
 * First-seen matches that already have a result are intentionally excluded (no backfill).
 */
export function findNewlyConcludedMatches<T extends MatchForConclusion>(
  previousMatches: readonly MatchForConclusion[],
  incomingMatches: readonly T[],
  configuredSportsclubUuids: ReadonlySet<string>,
): T[] {
  const previousByUuid = new Map<string, MatchForConclusion>();
  for (const match of previousMatches) {
    previousByUuid.set(match.uuid, match);
  }

  const newlyConcluded: T[] = [];
  const seenUuids = new Set<string>();

  for (const incoming of incomingMatches) {
    if (seenUuids.has(incoming.uuid)) continue;
    seenUuids.add(incoming.uuid);

    if (!incoming.hasResult) continue;
    if (!involvesConfiguredClub(incoming, configuredSportsclubUuids)) continue;

    const previous = previousByUuid.get(incoming.uuid);
    if (!previous || previous.hasResult) continue;

    newlyConcluded.push(incoming);
  }

  return newlyConcluded;
}
