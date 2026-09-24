import dayjs from "dayjs";
import type { AppTermineMatchInput, HeimspielCard } from "@/lib/db/schemas";

/** Homepage shows home games inside this many days, capped by date+location groups. */
export const HEIMSPIELE_TIME_RANGE_DAYS = 14;
export const HEIMSPIELE_MAX_DATE_LOCATIONS = 4;

/**
 * Future home games as card rows. Past games and away games stay out so the
 * document does not depend on "today" — the window is applied at read time.
 */
export function buildHeimspieleProjection(
  matches: readonly AppTermineMatchInput[],
): HeimspielCard[] {
  const byUuid = new Map<string, HeimspielCard>();

  for (const match of matches) {
    if (!match.isHomeGame || match.hasResult) continue;

    const opponentName = match.team2.name.trim();
    if (!opponentName) continue;

    byUuid.set(match.matchUuid, {
      matchUuid: match.matchUuid,
      ...(match.date ? { date: match.date } : {}),
      ...(match.time ? { time: match.time } : {}),
      ...(match.leagueUuid ? { leagueUuid: match.leagueUuid } : {}),
      ...(match.leagueName ? { leagueName: match.leagueName } : {}),
      team1Uuid: match.team1.uuid,
      team2Uuid: match.team2.uuid,
      opponentName,
      ...(match.location?.name ? { locationName: match.location.name } : {}),
      ...(match.location?.uuid ? { locationUuid: match.location.uuid } : {}),
    });
  }

  return [...byUuid.values()].sort((left, right) =>
    (left.date ?? "").localeCompare(right.date ?? ""),
  );
}

/** Apply the homepage window. `now` is injected so the cut stays testable. */
export function selectHeimspieleCards(
  games: readonly HeimspielCard[],
  now: Date = new Date(),
): HeimspielCard[] {
  const sorted = [...games].sort((left, right) => {
    if (!left.date || !right.date) return 0;
    return dayjs(left.date).valueOf() - dayjs(right.date).valueOf();
  });
  const horizon = dayjs(now).add(HEIMSPIELE_TIME_RANGE_DAYS, "day");
  const seen = new Set<string>();
  const result: HeimspielCard[] = [];

  for (const game of sorted) {
    const key = `${game.date ?? ""}${game.locationUuid ?? ""}`;
    const withinHorizon = Boolean(game.date) && dayjs(game.date).isBefore(horizon);
    const groupStillOpen = seen.size < HEIMSPIELE_MAX_DATE_LOCATIONS || seen.has(key);
    if (withinHorizon && groupStillOpen) {
      seen.add(key);
      result.push(game);
    }
  }

  return result;
}
