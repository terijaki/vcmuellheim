import dayjs from "dayjs";

export type SamsMatchRangeFilter = "past" | "future";

export type SamsMatchFilterInput = {
  range?: SamsMatchRangeFilter;
  limit?: number;
};

type MatchWithResult = {
  date?: string | null;
  results?: { winner?: string | null } | null;
};

/** Post-fetch range/limit filtering for SAMS league matches (after API pagination). */
export function filterAndSortSamsMatches<T extends MatchWithResult>(
  allMatches: readonly T[],
  input?: SamsMatchFilterInput,
): T[] {
  let filteredMatches = [...allMatches];
  if (input?.range === "future") {
    filteredMatches = allMatches.filter((m) => !m.results?.winner);
    filteredMatches.sort((a, b) =>
      !a.date ? 1 : !b.date ? -1 : dayjs(a.date).isBefore(dayjs(b.date)) ? -1 : 1,
    );
  } else if (input?.range === "past") {
    filteredMatches = allMatches.filter((m) => !!m.results?.winner);
    filteredMatches.sort((a, b) =>
      !a.date ? 1 : !b.date ? -1 : dayjs(a.date).isAfter(dayjs(b.date)) ? -1 : 1,
    );
  }

  if (input?.limit) filteredMatches = filteredMatches.slice(0, input.limit);
  return filteredMatches;
}
