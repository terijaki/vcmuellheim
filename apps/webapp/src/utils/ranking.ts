export type RankingTeam = {
	leagueUuid?: string | null;
	leagueName?: string | null;
	seasonUuid?: string | null;
	associationUuid?: string | null;
};

export type LeagueOrderingContext = {
	leagueUuids: string[];
	leagueNameByUuid: Map<string, string>;
	leagueOrderByUuid: Map<string, number>;
	seasonUuid: string | undefined;
	associationUuid: string | undefined;
};

export function buildLeagueOrderingContext(teams: RankingTeam[]): LeagueOrderingContext {
	const leagueUuids = [...new Set(teams.map((team) => team.leagueUuid).filter((leagueUuid): leagueUuid is string => !!leagueUuid))];
	const leagueOrderByUuid = new Map(leagueUuids.map((leagueUuid, index) => [leagueUuid, index]));
	const leagueNameByUuid = new Map(teams.filter((team): team is RankingTeam & { leagueUuid: string } => !!team.leagueUuid).map((team) => [team.leagueUuid, team.leagueName ?? ""]));

	return {
		leagueUuids,
		leagueNameByUuid,
		leagueOrderByUuid,
		seasonUuid: teams.find((team) => team.seasonUuid)?.seasonUuid ?? undefined,
		associationUuid: teams.find((team) => team.associationUuid)?.associationUuid ?? undefined,
	};
}

export function sortLeagueUuidsByLevels(args: {
	leagueUuids: string[];
	leagueLevels: Record<string, number | null>;
	leagueNameByUuid: Map<string, string>;
	leagueOrderByUuid: Map<string, number>;
}): string[] {
	const { leagueUuids, leagueLevels, leagueNameByUuid, leagueOrderByUuid } = args;

	return [...leagueUuids].sort((a, b) => {
		const levelA = leagueLevels[a] ?? Number.POSITIVE_INFINITY;
		const levelB = leagueLevels[b] ?? Number.POSITIVE_INFINITY;

		if (levelA !== levelB) {
			return levelA - levelB;
		}

		const nameCompare = (leagueNameByUuid.get(a) ?? "").localeCompare(leagueNameByUuid.get(b) ?? "");
		if (nameCompare !== 0) {
			return nameCompare;
		}

		return (leagueOrderByUuid.get(a) ?? 0) - (leagueOrderByUuid.get(b) ?? 0);
	});
}

export function calculateLastResultCap(teamCount: number, gamesPerTeam: number): number {
	return Math.max(6, Math.min(20, Math.floor(teamCount * gamesPerTeam)));
}
