import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import CardTitle from "../components/CardTitle";
import CenteredLoader from "../components/CenteredLoader";
import PageWithHeading from "../components/layout/PageWithHeading";
import RankingTable from "../components/RankingTable";
import { useSamsRankingsByLeagueUuid, useSamsTeams, useTeams } from "../lib/hooks";

// import { numToWord } from "num-words-de";

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export const Route = createFileRoute("/tabelle")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data: samsTeams } = useSamsTeams();
	const { data: teams } = useTeams();

	const sbvvTeamIds = new Set<string>();
	samsTeams?.teams.forEach((team) => {
		sbvvTeamIds.add(team.leagueUuid);
	});

	const { data, isLoading, error } = useSamsRankingsByLeagueUuid(Array.from(sbvvTeamIds));
	if (error) throw error;

	const lastResultCap = Math.max(6, Math.min(20, Number(((teams?.items.length || 0) * GAMES_PER_TEAM).toFixed(0)))); // calculate the total number of games to display based on the number of teams
	// TODO fetch # recent matches where # is number of recent matches
	// const lastResultWord = recentMatches.length > 1 && numToWords.numToWord(recentMatches.length, { uppercase: false });

	return (
		<PageWithHeading title={"Tabelle"}>
			{isLoading && <CenteredLoader text="Lade Tabellendaten..." />}
			{!isLoading && (!data || data.length === 0) && <NoRankingsData />}
			{data && data.length > 0 && (
				<Stack>
					<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
						{data?.map((ranking) => {
							return (
								<Suspense key={ranking.leagueUuid} fallback={<Card>lade Tabelle..</Card>}>
									<RankingTable ranking={ranking} linkToTeamPage={true} teams={teams?.items} />
								</Suspense>
							);
						})}
					</SimpleGrid>
					{/* {recentMatches && recentMatches.length > 0 && (
				<Card>
					<CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
					<CardSection p={{ base: undefined, sm: "sm" }}>
						<Matches matches={recentMatches} type="past" />
					</CardSection>
				</Card>
			)} */}
				</Stack>
			)}
		</PageWithHeading>
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
