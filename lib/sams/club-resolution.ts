import { resolveConfiguredSamsSportsclubUuids, SAMS_TARGET_CLUB_SLUGS } from "@utils/sams";

export type SamsClubRecord = {
  nameSlug?: string | null;
  sportsclubUuid?: string | null;
  name?: string;
  associationUuid?: string | null;
};

/** Slugs from project config that have no matching club record in storage. */
export function findMissingConfiguredClubSlugs(clubs: readonly SamsClubRecord[]): string[] {
  return SAMS_TARGET_CLUB_SLUGS.filter(
    (clubSlug) => !clubs.some((club) => club.nameSlug === clubSlug && !!club.sportsclubUuid),
  );
}

/** Keeps only clubs that match configured target slugs and have a sportsclub UUID. */
export function filterConfiguredSamsClubs<T extends SamsClubRecord>(clubs: readonly T[]): T[] {
  const sportsclubUuids = new Set(resolveConfiguredSamsSportsclubUuids(clubs));
  return clubs.filter(
    (club) => club.sportsclubUuid && sportsclubUuids.has(club.sportsclubUuid),
  ) as T[];
}
