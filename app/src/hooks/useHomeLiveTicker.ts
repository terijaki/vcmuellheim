import { SAMS } from "@project.config";
import { toLiveTickerDisplayMatches } from "../utils/liveTicker";
import { useLiveTicker, useSamsTeams } from "./dataQueries";

export function useHomeLiveTickerData() {
	const { data: tickerData } = useLiveTicker();
	const { data: samsTeamsData } = useSamsTeams();
	const liveMatches = tickerData?.liveMatches ?? [];
	const teams = samsTeamsData?.teams ?? [];

	const ourTeamUuids = new Set(teams.filter((team) => team.name.includes(SAMS.name)).map((team) => team.uuid));
	const teamClubByUuid = new Map(teams.map((team) => [team.uuid, team.sportsclubUuid]));

	const ourMatches = toLiveTickerDisplayMatches({ liveMatches, ourTeamUuids, teamClubByUuid });
	const hasMatchesToday = ourMatches.length > 0;
	const hasOpenMatches = ourMatches.some((match) => !match.isFinished);

	return {
		ourMatches,
		hasMatchesToday,
		hasOpenMatches,
	};
}
