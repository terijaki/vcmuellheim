import type { LiveMatch } from "@/lambda/sams/types";
import { slugify } from "@/utils/slugify";

type TeamSide = "team1" | "team2";

export type LiveTickerDisplayMatch = {
	matchUuid: string;
	team1Name: string;
	team2Name: string;
	team1ClubUuid?: string;
	team2ClubUuid?: string;
	team1ClubSlug?: string;
	team2ClubSlug?: string;
	setPointsText: string;
	team1SetPoints: number;
	team2SetPoints: number;
	setScores: Array<{
		setNumber: number;
		team1Score: number;
		team2Score: number;
	}>;
	activeSetNumber: number | null;
	isFinished: boolean;
	weAreWinning: boolean;
};

export function toLiveTickerDisplayMatches(args: {
	liveMatches: LiveMatch[];
	ourTeamUuids: Set<string>;
	teamNameByUuid: Map<string, string>;
	teamClubByUuid: Map<string, string>;
}): LiveTickerDisplayMatch[] {
	const { liveMatches, ourTeamUuids, teamNameByUuid, teamClubByUuid } = args;

	const result: LiveTickerDisplayMatch[] = [];

	for (const match of liveMatches) {
		const ourSide = getOurSide(match, ourTeamUuids);
		if (!ourSide) continue;

		const otherSide: TeamSide = ourSide === "team1" ? "team2" : "team1";
		const team1SetPoints = match.state.setPoints.team1;
		const team2SetPoints = match.state.setPoints.team2;
		const setPointsText = `${match.state.setPoints.team1}:${match.state.setPoints.team2}`;
		const setScores = [...match.state.matchSets]
			.sort((a, b) => a.setNumber - b.setNumber)
			.map((setItem) => ({
				setNumber: setItem.setNumber,
				team1Score: setItem.setScore.team1,
				team2Score: setItem.setScore.team2,
			}));
		const activeSetNumber = !match.state.finished && setScores.length > 0 ? (setScores[setScores.length - 1]?.setNumber ?? null) : null;

		const team1Name = match.team1Name || teamNameByUuid.get(match.team1Uuid) || match.team1Uuid;
		const team2Name = match.team2Name || teamNameByUuid.get(match.team2Uuid) || match.team2Uuid;
		result.push({
			matchUuid: match.matchUuid,
			team1Name,
			team2Name,
			team1ClubUuid: teamClubByUuid.get(match.team1Uuid),
			team2ClubUuid: teamClubByUuid.get(match.team2Uuid),
			team1ClubSlug: slugify(team1Name.replace(/\s+\d+$/, "")),
			team2ClubSlug: slugify(team2Name.replace(/\s+\d+$/, "")),
			setPointsText,
			team1SetPoints,
			team2SetPoints,
			setScores,
			activeSetNumber,
			isFinished: match.state.finished,
			weAreWinning: match.state.setPoints[ourSide] > match.state.setPoints[otherSide],
		});
	}

	return result;
}

function getOurSide(match: LiveMatch, ourTeamUuids: Set<string>): TeamSide | null {
	if (ourTeamUuids.has(match.team1Uuid)) return "team1";
	if (ourTeamUuids.has(match.team2Uuid)) return "team2";
	return null;
}
