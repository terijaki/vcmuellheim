import { Card, CardSection, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import RankingTable from "@webapp/components/RankingTable";
import { useSamsMatches, useSamsRankingsByLeagueUuid } from "@webapp/hooks/dataQueries";
import { getSamsLeagueLevelsByLeagueUuidsFn, getSamsMatchesFn, getSamsRankingsByLeagueUuidsFn, listSamsTeamsFn } from "@webapp/server/functions/sams";
import { listTeamsFn } from "@webapp/server/functions/teams";
import { buildLeagueOrderingContext, calculateLastResultCap, sortLeagueUuidsByLevels } from "@webapp/utils/ranking";
import { numToWord } from "num-words-de";
import type { LeagueMatchesResponse, RankingResponse } from "@/lambda/sams/types";

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export const Route = createFileRoute("/_layout/tabelle")({
	loader: async () => {
		// Main data comes from DynamoDB; only a batched SAMS metadata lookup is used for league ordering.
		const [samsTeams, teams] = await Promise.all([listSamsTeamsFn(), listTeamsFn()]);
		const orderingContext = buildLeagueOrderingContext(samsTeams.teams);

		if (samsTeams.teams.length === 0) {
			return { leagueUuids: [], teams: teams.items, lastResultCap: 6, rankings: undefined, matches: undefined };
		}

		let leagueLevels: Record<string, number | null> = {};
		if (orderingContext.leagueUuids.length > 0) {
			try {
				leagueLevels = await getSamsLeagueLevelsByLeagueUuidsFn({
					data: {
						leagueUuids: orderingContext.leagueUuids,
						seasonUuid: orderingContext.seasonUuid,
						associationUuid: orderingContext.associationUuid,
					},
				});
			} catch (error) {
				console.error("Failed to fetch SAMS league levels for league UUIDs", {
					error,
					leagueUuids: orderingContext.leagueUuids,
					seasonUuid: orderingContext.seasonUuid,
					associationUuid: orderingContext.associationUuid,
				});
				leagueLevels = {};
			}
		}

		const sortedLeagueUuids = sortLeagueUuidsByLevels({
			leagueUuids: orderingContext.leagueUuids,
			leagueLevels,
			leagueNameByUuid: orderingContext.leagueNameByUuid,
			leagueOrderByUuid: orderingContext.leagueOrderByUuid,
		});
		const lastResultCap = calculateLastResultCap(samsTeams.teams.length, GAMES_PER_TEAM);

		let rankings: RankingResponse[] | undefined;
		let matches: LeagueMatchesResponse | undefined;
		if (sortedLeagueUuids.length > 0) {
			try {
				[rankings, matches] = await Promise.all([getSamsRankingsByLeagueUuidsFn({ data: { leagueUuids: sortedLeagueUuids } }), getSamsMatchesFn({ data: { range: "past", limit: lastResultCap } })]);
			} catch (error) {
				console.error("Failed to prefetch SAMS data in tabelle loader", { error });
				// rankings and matches stay undefined — React Query will fetch client-side
			}
		}
		return { leagueUuids: sortedLeagueUuids, teams: teams.items, lastResultCap, rankings, matches };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { leagueUuids, teams, lastResultCap, rankings: loaderRankings, matches: loaderMatches } = Route.useLoaderData();

	const rankingsInitialDataUpdatedAt = loaderRankings?.[0]?.timestamp ? new Date(loaderRankings[0].timestamp).getTime() : undefined;
	const matchesInitialDataUpdatedAt = loaderMatches?.timestamp ? new Date(loaderMatches.timestamp).getTime() : undefined;

	const {
		data: rankingsData,
		isLoading: isLoadingRankings,
		isFetching: isFetchingRankings,
		isError: isRankingsError,
	} = useSamsRankingsByLeagueUuid(leagueUuids, {
		initialData: loaderRankings,
		initialDataUpdatedAt: rankingsInitialDataUpdatedAt,
	});
	const {
		data: matchesData,
		isLoading: isLoadingMatches,
		isError: isMatchesError,
	} = useSamsMatches({
		range: "past",
		limit: lastResultCap,
		initialData: loaderMatches,
		initialDataUpdatedAt: matchesInitialDataUpdatedAt,
	});
	const recentMatches = matchesData?.matches ?? [];
	const lastResultWord = recentMatches.length > 1 && numToWord(recentMatches.length, { uppercase: false });
	const hasRankings = !!rankingsData && rankingsData.length > 0;

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
							{rankingsData.map((ranking) => (
								<RankingTable key={ranking.leagueUuid} ranking={ranking} linkToTeamPage={true} clubsTeams={teams} isFetching={isFetchingRankings} />
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
