import dayjs from "dayjs";

/**
 * Mirrors sams-provider `club-match-schedule` window constants
 * (see terijaki/sams-provider `SCHEDULE_LOOKBACK_DAYS` / `SCHEDULE_LOOKAHEAD_DAYS`).
 */
export const SAMS_CLUB_SCHEDULE_LOOKBACK_DAYS = 14;
export const SAMS_CLUB_SCHEDULE_LOOKAHEAD_DAYS = 365;

type ScheduleWindowMatch = {
  date?: string | null;
  time?: string | null;
};

/** True when a match falls in the provider's club schedule event window. */
export function isClubScheduleWindow(match: ScheduleWindowMatch, now: Date = new Date()): boolean {
  if (!match.date) {
    return false;
  }
  const nowDayjs = dayjs(now);
  const start = dayjs(`${match.date}T${match.time ?? "00:00"}:00`);
  return (
    !start.isBefore(nowDayjs.subtract(SAMS_CLUB_SCHEDULE_LOOKBACK_DAYS, "day")) &&
    !start.isAfter(nowDayjs.add(SAMS_CLUB_SCHEDULE_LOOKAHEAD_DAYS, "day"))
  );
}

type IdentifiedScheduleMatch = ScheduleWindowMatch & { uuid: string };

/**
 * Merge an incoming `clubMatchScheduleUpdated` payload into stored schedule matches.
 * Matches outside the provider window are kept; in-window rows follow the event payload.
 */
export function mergeClubScheduleProjectionMatches<T extends IdentifiedScheduleMatch>(
  existingMatches: readonly T[],
  incomingMatches: readonly T[],
  now: Date = new Date(),
): T[] {
  const incomingByUuid = new Map(incomingMatches.map((match) => [match.uuid, match]));
  const preservedOutsideWindow = existingMatches.filter(
    (match) => !isClubScheduleWindow(match, now) && !incomingByUuid.has(match.uuid),
  );

  const mergedByUuid = new Map<string, T>();
  for (const match of preservedOutsideWindow) {
    mergedByUuid.set(match.uuid, match);
  }
  for (const match of incomingMatches) {
    mergedByUuid.set(match.uuid, match);
  }
  return [...mergedByUuid.values()];
}
