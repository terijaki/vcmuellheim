import {
  resolveConfiguredSamsSportsclubUuids,
  resolveSamsClubSlug,
  SAMS_TARGET_CLUB_SLUGS,
} from "@utils/sams";

export type SamsClubRecord = {
  nameSlug?: string | null;
  name?: string | null;
  sportsclubUuid?: string | null;
  associationUuid?: string | null;
};

/** Slugs from project config that have no matching club record in storage. */
export function findMissingConfiguredClubSlugs(clubs: readonly SamsClubRecord[]): string[] {
  return SAMS_TARGET_CLUB_SLUGS.filter(
    (clubSlug) =>
      !clubs.some((club) => resolveSamsClubSlug(club) === clubSlug && !!club.sportsclubUuid),
  );
}

/** Keeps only clubs that match configured target slugs and have a sportsclub UUID. */
export function filterConfiguredSamsClubs<T extends SamsClubRecord>(clubs: readonly T[]): T[] {
  const sportsclubUuids = new Set(resolveConfiguredSamsSportsclubUuids(clubs));
  return clubs.filter(
    (club): club is T => !!club.sportsclubUuid && sportsclubUuids.has(club.sportsclubUuid),
  );
}

/** Resolves configured clubs from a storage snapshot (no I/O). */
export function resolveConfiguredSamsClubsFromRecords(clubs: readonly SamsClubRecord[]): {
  configuredClubs: SamsClubRecord[];
  sportsclubUuids: string[];
  missingClubSlugs: string[];
} {
  const missingClubSlugs = findMissingConfiguredClubSlugs(clubs);
  return {
    configuredClubs: filterConfiguredSamsClubs(clubs),
    sportsclubUuids: resolveConfiguredSamsSportsclubUuids(clubs),
    missingClubSlugs,
  };
}

/** Resolves configured sportsclub UUIDs and reports missing target slugs. */
export function resolveConfiguredSportsclubUuidsFromClubs(clubs: readonly SamsClubRecord[]): {
  sportsclubUuids: string[];
  missingClubSlugs: string[];
} {
  const resolved = resolveConfiguredSamsClubsFromRecords(clubs);
  return {
    sportsclubUuids: resolved.sportsclubUuids,
    missingClubSlugs: resolved.missingClubSlugs,
  };
}
