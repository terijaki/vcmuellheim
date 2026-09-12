import { APP_DATASET_CURRENT } from "@/lib/db/schemas";

export { APP_DATASET_CURRENT };

/** Zero-pad hierarchy level so league SKs sort numerically as strings. */
export function padLeagueSortLevel(level: number | undefined): string {
  const value = level ?? 99999;
  return String(value).padStart(5, "0");
}

/**
 * Termine SK prefixes partition past/future so DynamoDB can query one range
 * without loading the other. Past uses ascending date; readers query with
 * ScanIndexForward=false for newest-first.
 */
export function buildTermineMatchSortKey(
  hasResult: boolean,
  date: string | null | undefined,
  matchUuid: string,
): string {
  const prefix = hasResult ? "P" : "F";
  const sortableDate = date && date.length > 0 ? date : "9999-12-31T23:59:59.999Z";
  return `${prefix}#${sortableDate}#${matchUuid}`;
}

export function seasonDatasetId(seasonUuid: string): string {
  return `season#${seasonUuid}`;
}
