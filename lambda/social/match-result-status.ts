/**
 * Club-centric German Mastodon status text for concluded SAMS matches.
 */

import { isConfiguredSportsclubUuid } from "@/utils/sams";

export type MatchResultTeam = {
  uuid: string;
  name: string;
  sportsclubUuid?: string;
};

export type MatchResultSet = {
  number: number;
  ballPoints?: string;
};

export type MatchResult = {
  winner?: string | null;
  setPoints?: string | null;
  sets?: MatchResultSet[];
};

export type MatchForStatus = {
  team1: MatchResultTeam;
  team2: MatchResultTeam;
  result?: MatchResult;
};

export type StringPicker = (items: readonly string[]) => string;

export const WIN_TEMPLATES = [
  "{our} gewinnt {score} gegen {opp}",
  "Sieg für {our}: {score} gegen {opp}",
  "{our} schlägt {opp} mit {score}",
  "{our} holt den Sieg gegen {opp} ({score})",
  "{our} setzt sich {score} gegen {opp} durch",
] as const;

export const LOSS_TEMPLATES = [
  "{our} unterliegt {opp} mit {score}",
  "Niederlage für {our}: {score} gegen {opp}",
  "{our} verliert {score} gegen {opp}",
  "{our} muss sich {opp} mit {score} geschlagen geben",
  "Kein Erfolg für {our} — {score} gegen {opp}",
] as const;

/** Oriented set-score → emoji pool (German ranking-point mood). */
export const EMOJI_POOLS: Record<string, readonly string[]> = {
  "3:0": ["🔥", "🏆", "✨"],
  "3:1": ["🏆", "🎉", "💪"],
  "3:2": ["💪", "✨", "🎉"],
  "2:3": ["✋", "👌", "🫤"],
  "1:3": ["😞", "😔"],
  "0:3": ["🌧️", "😔", "🙁"],
};

const OTHER_WIN_EMOJIS = ["🏆", "🎉", "💪"] as const;
const OTHER_LOSS_EMOJIS = ["😔", "😞"] as const;

export function defaultRandomPicker(items: readonly string[]): string {
  if (items.length === 0) {
    throw new Error("Cannot pick from an empty list");
  }
  return items[Math.floor(Math.random() * items.length)]!;
}

function flipScore(score: string): string {
  const [left, right] = score.split(":");
  if (left === undefined || right === undefined) return score;
  return `${right}:${left}`;
}

function parseOrientedSetPoints(
  setPoints: string,
): { our: number; opp: number; oriented: string } | null {
  const parts = setPoints.split(":");
  if (parts.length !== 2) return null;
  const our = Number(parts[0]);
  const opp = Number(parts[1]);
  if (!Number.isFinite(our) || !Number.isFinite(opp)) return null;
  return { our, opp, oriented: `${our}:${opp}` };
}

function interpolate(
  template: string,
  values: { our: string; opp: string; score: string },
): string {
  return template
    .replaceAll("{our}", values.our)
    .replaceAll("{opp}", values.opp)
    .replaceAll("{score}", values.score);
}

function formatSetsLine(sets: MatchResultSet[] | undefined, flip: boolean): string | undefined {
  if (!sets || sets.length === 0) return undefined;

  const scores: string[] = [];
  for (const set of [...sets].sort((a, b) => a.number - b.number)) {
    if (!set.ballPoints) continue;
    scores.push(flip ? flipScore(set.ballPoints) : set.ballPoints);
  }
  if (scores.length === 0) return undefined;
  return `Sätze: ${scores.join(", ")}`;
}

function pickOurSide(
  match: MatchForStatus,
  configuredSportsclubUuids: ReadonlySet<string>,
): { our: MatchResultTeam; opp: MatchResultTeam; ourIsTeam1: boolean } | null {
  const team1Configured = isConfiguredSportsclubUuid(
    match.team1.sportsclubUuid,
    configuredSportsclubUuids,
  );
  const team2Configured = isConfiguredSportsclubUuid(
    match.team2.sportsclubUuid,
    configuredSportsclubUuids,
  );

  if (team1Configured && team2Configured) {
    const winnerUuid = match.result?.winner;
    if (winnerUuid === match.team1.uuid) {
      return { our: match.team1, opp: match.team2, ourIsTeam1: true };
    }
    if (winnerUuid === match.team2.uuid) {
      return { our: match.team2, opp: match.team1, ourIsTeam1: false };
    }

    const setPoints = match.result?.setPoints;
    if (setPoints) {
      const parsed = parseOrientedSetPoints(setPoints);
      if (parsed) {
        if (parsed.our > parsed.opp) {
          return { our: match.team1, opp: match.team2, ourIsTeam1: true };
        }
        if (parsed.opp > parsed.our) {
          return { our: match.team2, opp: match.team1, ourIsTeam1: false };
        }
      }
    }
    return { our: match.team1, opp: match.team2, ourIsTeam1: true };
  }

  if (team1Configured) {
    return { our: match.team1, opp: match.team2, ourIsTeam1: true };
  }
  if (team2Configured) {
    return { our: match.team2, opp: match.team1, ourIsTeam1: false };
  }
  return null;
}

function classifyOutcome(
  orientedScore: string | undefined,
  ourTeamUuid: string,
  winnerUuid: string | null | undefined,
): "win" | "loss" | "unknown" {
  if (orientedScore) {
    const parsed = parseOrientedSetPoints(orientedScore);
    if (parsed) {
      if (parsed.our > parsed.opp) return "win";
      if (parsed.our < parsed.opp) return "loss";
    }
  }
  if (winnerUuid) {
    if (winnerUuid === ourTeamUuid) return "win";
    return "loss";
  }
  return "unknown";
}

function emojiForOrientedScore(
  orientedScore: string | undefined,
  outcome: "win" | "loss",
  pick: StringPicker,
): string {
  if (orientedScore && EMOJI_POOLS[orientedScore]) {
    return pick(EMOJI_POOLS[orientedScore]!);
  }
  return outcome === "win" ? pick(OTHER_WIN_EMOJIS) : pick(OTHER_LOSS_EMOJIS);
}

export function buildMatchResultStatus(
  match: MatchForStatus,
  configuredSportsclubUuids: ReadonlySet<string> | readonly string[],
  options?: {
    pickTemplate?: StringPicker;
    pickEmoji?: StringPicker;
  },
): string | null {
  const configured =
    configuredSportsclubUuids instanceof Set
      ? configuredSportsclubUuids
      : new Set(configuredSportsclubUuids);

  const sides = pickOurSide(match, configured);
  if (!sides) return null;

  const pickTemplate = options?.pickTemplate ?? defaultRandomPicker;
  const pickEmoji = options?.pickEmoji ?? defaultRandomPicker;

  const rawSetPoints = match.result?.setPoints ?? undefined;
  const orientedScore = rawSetPoints
    ? sides.ourIsTeam1
      ? rawSetPoints
      : flipScore(rawSetPoints)
    : undefined;

  const outcome = classifyOutcome(orientedScore, sides.our.uuid, match.result?.winner);
  const setsLine = formatSetsLine(match.result?.sets, !sides.ourIsTeam1);
  const scoreForText = orientedScore ?? "";

  if (outcome === "unknown") {
    const neutral = `${sides.our.name} – ${sides.opp.name}${scoreForText ? ` ${scoreForText}` : ""}`;
    return setsLine ? `${neutral}\n\n${setsLine}` : neutral;
  }

  const templates = outcome === "win" ? WIN_TEMPLATES : LOSS_TEMPLATES;
  const template = pickTemplate(templates);
  const body = interpolate(template, {
    our: sides.our.name,
    opp: sides.opp.name,
    score: scoreForText,
  }).replace(/ {2,}/g, " ");
  const emoji = emojiForOrientedScore(orientedScore, outcome, pickEmoji);
  const status = `${emoji} ${body}`;
  return setsLine ? `${status}\n\n${setsLine}` : status;
}
