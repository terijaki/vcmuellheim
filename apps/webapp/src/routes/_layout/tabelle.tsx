import { Card, CardSection, SimpleGrid, Stack, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import CardTitle from "@webapp/components/CardTitle";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import Matches from "@webapp/components/Matches";
import RankingTable from "@webapp/components/RankingTable";
import { getSamsMatchesFn, getSamsRankingsByLeagueUuidsFn, listSamsTeamsFn } from "@webapp/server/functions/sams";
import { listTeamsFn } from "@webapp/server/functions/teams";
import { numToWord } from "num-words-de";
import { Suspense } from "react";

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export const Route = createFileRoute("/_layout/tabelle")({
	loader: async () => {
		const samsTeams = await listSamsTeamsFn();
		const leagueUuids = [...new Set(samsTeams.teams.map((t) => t.leagueUuid).filter(Boolean))];
		const lastResultCap = Math.max(6, Math.min(20, Math.floor(samsTeams.teams.length * GAMES_PER_TEAM)));

		const [rankings, teams, matches] = await Promise.all([
			leagueUuids.length > 0 ? getSamsRankingsByLeagueUuidsFn({ data: { leagueUuids } }) : Promise.resolve([]),
			listTeamsFn(),
			getSamsMatchesFn({ data: { range: "past", limit: lastResultCap } }),
		]);

		return {
			rankings,
			teams: teams.items,
			recentMatches: matches.matches,
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { rankings, teams, recentMatches } = Route.useLoaderData();
	const lastResultWord = recentMatches.length > 1 && numToWord(recentMatches.length, { uppercase: false });

	return (
		<PageWithHeading title={"Tabelle"}>
			{(!rankings || rankings.length === 0) && <NoRankingsData />}
			{rankings && rankings.length > 0 && (
				<Stack>
					<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
						{rankings.map((ranking) => (
							<Suspense key={ranking.leagueUuid} fallback={<Card>lade Tabelle..</Card>}>
								<RankingTable ranking={ranking} linkToTeamPage={true} clubsTeams={teams} />
							</Suspense>
						))}
					</SimpleGrid>
					{recentMatches.length > 0 && (
						<Card>
							<CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
							<CardSection p={{ base: undefined, sm: "sm" }}>
								<Matches matches={recentMatches} type="past" />
							</CardSection>
						</Card>
					)}
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
