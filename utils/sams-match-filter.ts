import dayjs from "dayjs";
import type { SamsMatchesInput } from "@utils/sams-matches";

export type SamsMatchFilterInput = Pick<SamsMatchesInput, "range" | "limit">;

type MatchWithResult = {
  date?: string | null;
  hasResult?: boolean;
};

function compareMatchDates(a: MatchWithResult, b: MatchWithResult, ascending: boolean): number {
  if (!a.date) return 1;
  if (!b.date) return -1;
  const aDate = dayjs(a.date);
  const bDate = dayjs(b.date);
  if (aDate.isSame(bDate)) return 0;
  return ascending ? (aDate.isBefore(bDate) ? -1 : 1) : aDate.isAfter(bDate) ? -1 : 1;
}

function filterAndSortByRange<T extends MatchWithResult>(
  matches: readonly T[],
  range: "past" | "future",
): T[] {
  const filtered =
    range === "future"
      ? matches.filter((match) => !match.hasResult)
      : matches.filter((match) => !!match.hasResult);
  return [...filtered].sort((a, b) => compareMatchDates(a, b, range === "future"));
}

/** Post-fetch range/limit filtering for SAMS league matches (after API pagination). */
export function filterAndSortSamsMatches<T extends MatchWithResult>(
  allMatches: readonly T[],
  input?: SamsMatchFilterInput,
): T[] {
  let filteredMatches = [...allMatches];
  if (input?.range === "future") {
    filteredMatches = filterAndSortByRange(allMatches, "future");
  } else if (input?.range === "past") {
    filteredMatches = filterAndSortByRange(allMatches, "past");
  }

  if (input?.limit) filteredMatches = filteredMatches.slice(0, input.limit);
  return filteredMatches;
}
