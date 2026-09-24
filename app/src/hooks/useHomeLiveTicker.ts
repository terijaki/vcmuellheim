import { getOwnedSamsTeamUuids } from "@/utils/sams";
import { toLiveTickerDisplayMatches } from "../utils/liveTicker";
import { useLiveTicker, useSamsTeams } from "./dataQueries";

export function useHomeLiveTickerData() {
  const { data: tickerData, isPending: isTickerPending } = useLiveTicker();
  const { data: samsTeamsData, isPending: isTeamsPending } = useSamsTeams();
  const liveMatches = tickerData?.liveMatches ?? [];
  const teams = samsTeamsData?.teams ?? [];

  const ourTeamUuids = getOwnedSamsTeamUuids(teams);
  const teamClubByUuid = new Map(teams.map((team) => [team.uuid, team.sportsclubUuid]));

  const ourMatches = toLiveTickerDisplayMatches({ liveMatches, ourTeamUuids, teamClubByUuid });
  const hasMatchesToday = ourMatches.length > 0;
  const hasOpenMatches = ourMatches.some((match) => !match.isFinished);

  return {
    ourMatches,
    hasMatchesToday,
    hasOpenMatches,
    isPending: isTickerPending || isTeamsPending,
  };
}
