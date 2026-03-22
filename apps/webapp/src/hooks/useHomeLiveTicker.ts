import { SAMS } from "@project.config";
import { useMemo } from "react";
import { toLiveTickerDisplayMatches } from "../utils/liveTicker";
import { useLiveTicker, useSamsTeams } from "./dataQueries";

export function useHomeLiveTickerData() {
	const { data: tickerData } = useLiveTicker();
	const { data: samsTeamsData } = useSamsTeams();
	const liveMatches = tickerData?.liveMatches ?? [];
	const teams = samsTeamsData?.teams ?? [];

	const ourTeamUuids = useMemo(() => new Set(teams.filter((team) => team.name.includes(SAMS.name)).map((team) => team.uuid)), [teams]);
	const teamNameByUuid = useMemo(() => new Map(teams.map((team) => [team.uuid, team.name])), [teams]);
	const teamClubByUuid = useMemo(() => new Map(teams.map((team) => [team.uuid, team.sportsclubUuid])), [teams]);

	const ourMatches = useMemo(() => toLiveTickerDisplayMatches({ liveMatches, ourTeamUuids, teamNameByUuid, teamClubByUuid }), [liveMatches, ourTeamUuids, teamNameByUuid, teamClubByUuid]);
	const hasMatchesToday = ourMatches.length > 0;
	const hasOpenMatches = ourMatches.some((match) => !match.isFinished);

	return {
		ourMatches,
		hasMatchesToday,
		hasOpenMatches,
	};
}
