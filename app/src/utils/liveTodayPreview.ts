import dayjs, { type Dayjs } from "dayjs";

export type LiveTodayPreviewMatch = {
  uuid: string;
  date?: string | null;
  time?: string | null;
};

/** Keep today's scheduled matches that are not already shown in the live ticker. */
export function filterTodaysUpcomingMatches<T extends LiveTodayPreviewMatch>(
  matches: readonly T[],
  liveMatchUuids: ReadonlySet<string>,
  now: Dayjs = dayjs(),
): T[] {
  const todays: T[] = [];

  for (const match of matches) {
    if (!match.date || !dayjs(match.date).isValid()) continue;
    if (!dayjs(match.date).isSame(now, "day")) continue;
    if (liveMatchUuids.has(match.uuid)) continue;
    todays.push(match);
  }

  todays.sort((a, b) => {
    const aKey = `${a.date ?? ""}${a.time ?? ""}`;
    const bKey = `${b.date ?? ""}${b.time ?? ""}`;
    return aKey.localeCompare(bKey);
  });

  return todays;
}
