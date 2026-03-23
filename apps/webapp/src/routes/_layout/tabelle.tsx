import { Card, CardSection, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import RankingTable from "@webapp/components/RankingTable";
import { useSamsMatches, useSamsRankingsByLeagueUuid } from "@webapp/hooks/dataQueries";
import { getSamsLeagueLevelsByLeagueUuidsFn, listSamsTeamsFn } from "@webapp/server/functions/sams";
import { listTeamsFn } from "@webapp/server/functions/teams";
import { numToWord } from "num-words-de";

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export const Route = createFileRoute("/_layout/tabelle")({
	loader: async () => {
		// Main data comes from DynamoDB; only a batched SAMS metadata lookup is used for league ordering.
		const [samsTeams, teams] = await Promise.all([listSamsTeamsFn(), listTeamsFn()]);

		if (samsTeams.teams.length === 0) {
			return { leagueUuids: [], teams: teams.items, lastResultCap: 6 };
		}

		const leagueUuids = [...new Set(samsTeams.teams.map((t) => t.leagueUuid).filter(Boolean))];
		const leagueOrderByUuid = new Map(leagueUuids.map((leagueUuid, index) => [leagueUuid, index]));
		const leagueNameByUuid = new Map(samsTeams.teams.filter((t) => t.leagueUuid).map((t) => [t.leagueUuid as string, t.leagueName ?? ""]));
		const seasonUuid = samsTeams.teams.find((t) => t.seasonUuid)?.seasonUuid;
		const associationUuid = samsTeams.teams.find((t) => t.associationUuid)?.associationUuid;
		let leagueLevels: Record<string, number | null> = {};
		if (leagueUuids.length > 0) {
			try {
				leagueLevels = await getSamsLeagueLevelsByLeagueUuidsFn({
					data: { leagueUuids, seasonUuid, associationUuid },
				});
			} catch (error) {
				console.error("Failed to fetch SAMS league levels for league UUIDs", {
					error,
					leagueUuids,
					seasonUuid,
					associationUuid,
				});
				leagueLevels = {};
			}
		}
		const sortedLeagueUuids = [...leagueUuids].sort((a, b) => {
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
		const lastResultCap = Math.max(6, Math.min(20, Math.floor(samsTeams.teams.length * GAMES_PER_TEAM)));
		return { leagueUuids: sortedLeagueUuids, teams: teams.items, lastResultCap };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { leagueUuids, teams, lastResultCap } = Route.useLoaderData();
	const { data: rankings, isLoading: isLoadingRankings, isFetching: isFetchingRankings, isError: isRankingsError } = useSamsRankingsByLeagueUuid(leagueUuids);
	const { data: matchesData, isLoading: isLoadingMatches, isError: isMatchesError } = useSamsMatches({ range: "past", limit: lastResultCap });
	const recentMatches = matchesData?.matches ?? [];
	const lastResultWord = recentMatches.length > 1 && numToWord(recentMatches.length, { uppercase: false });
	const hasRankings = !!rankings && rankings.length > 0;

	return (
		<PageWithHeading title={"Tabelle"}>
			<Stack>
				{isLoadingRankings && <RankingsLoadingState leagueCount={leagueUuids.length} />}
				{!isLoadingRankings && isRankingsError && <RankingsErrorState />}
				{!isLoadingRankings && !isRankingsError && !hasRankings && <NoRankingsData />}
				{hasRankings && (
					<>
						{isFetchingRankings && (
							<Text c="dimmed" size="sm">
								Tabellen werden aktualisiert...
							</Text>
						)}
						<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
							{rankings.map((ranking) => (
								<RankingTable key={ranking.leagueUuid} ranking={ranking} linkToTeamPage={true} clubsTeams={teams} />
							))}
						</SimpleGrid>
					</>
				)}
				{isLoadingMatches && <MatchesLoadingState />}
				{!isLoadingMatches && isMatchesError && <MatchesErrorState />}
				{!isLoadingMatches && !isMatchesError && recentMatches.length > 0 && (
					<Card>
						<CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
						<CardSection p={{ base: undefined, sm: "sm" }}>
							<Matches matches={recentMatches} type="past" />
						</CardSection>
					</Card>
				)}
			</Stack>
		</PageWithHeading>
	);
}

function RankingsLoadingState({ leagueCount }: { leagueCount: number }) {
	const placeholderCount = Math.max(2, Math.min(6, leagueCount || 2));
	const placeholderSlots = Array.from({ length: placeholderCount }, (_, slot) => slot + 1);

	return (
		<>
			<Text c="dimmed" size="sm">
				Tabellen werden geladen...
			</Text>
			<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
				{placeholderSlots.map((slot) => (
					<Card key={`ranking-loading-${slot}`} p="md">
						<Stack align="center" py="xl" gap="xs">
							<Loader size="sm" />
							<Text c="dimmed" size="sm">
								Lade Tabelle...
							</Text>
						</Stack>
					</Card>
				))}
			</SimpleGrid>
		</>
	);
}

function RankingsErrorState() {
	return (
		<Card>
			<CardTitle>Fehler beim Laden der Tabellen</CardTitle>
			<Text>Die Tabellen konnten derzeit nicht geladen werden. Bitte versuche es in wenigen Minuten erneut.</Text>
		</Card>
	);
}

function MatchesLoadingState() {
	return (
		<Card>
			<CardTitle>Letzte Spiele</CardTitle>
			<Stack align="center" py="md" gap="xs">
				<Loader size="sm" />
				<Text c="dimmed" size="sm">
					Lade letzte Spiele...
				</Text>
			</Stack>
		</Card>
	);
}

function MatchesErrorState() {
	return (
		<Card>
			<CardTitle>Fehler beim Laden der letzten Spiele</CardTitle>
			<Text>Die letzten Spielresultate konnten derzeit nicht geladen werden. Bitte versuche es später erneut.</Text>
		</Card>
	);
}

function NoRankingsData() {
	const currentMonth = new Date().getMonth() + 1;
	return (
		<>
			<Card>
				<CardTitle>Keine Daten gefunden</CardTitle>
				<Text>Tablleninformationen stehen aktuell nicht zur Verfügung. Eventuell liegt ein technisches Problem vor, oder es ist einfach der falsche Zeitpunkt.</Text>
			</Card>
			{currentMonth >= 4 && currentMonth <= 9 && (
				<Card>
					<CardTitle>Außerhalb der Saison?</CardTitle>
					<Text>
						Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt. Dazwischen und kurz vor Saisonbeginn, wurden die neusten Informationen vom Südbadischen
						Volleyballverband ggf. noch nicht veröffentlicht.
					</Text>
				</Card>
			)}
		</>
	);
}
