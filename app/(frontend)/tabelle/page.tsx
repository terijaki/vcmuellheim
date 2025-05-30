import CardTitle from "@/components/CardTitle";
import Matches from "@/components/Matches";
import RankingTable from "@/components/RankingTable";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getTeams } from "@/data/teams";
import { samsClubMatches, samsClubRankings } from "@/utils/sams/sams-server-actions";
import { Card, CardSection, SimpleGrid, Stack, Text } from "@mantine/core";
import type { Metadata } from "next";
import { Suspense } from "react";

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export const metadata: Metadata = { title: "Tabelle" };

export const dynamic = "force-dynamic";

export default async function Tabelle() {
	const clubRankings = await samsClubRankings();
	if (!clubRankings || clubRankings.length === 0) return <NoRankingsData />;

	const teams = await getTeams(undefined, true); // fetch all teams with league information
	const teamSize = teams?.docs.length || 0;

	const lastResultCap = Math.max(6, Math.min(20, Number((teamSize * GAMES_PER_TEAM).toFixed(0)))); // calculate the total number of games
	const numToWordsDe = require("num-words-de");
	const recentMatches = await samsClubMatches({ past: true, limit: lastResultCap });
	const lastResultWord =
		recentMatches && recentMatches.length > 1 && numToWordsDe.numToWord(recentMatches.length, { uppercase: false });
	// return <NoRankingsData />;
	const matchSeriesDisplayed: string[] = []; //placeholder to avoid duplicate league displays
	return (
		<PageWithHeading title={"Tabelle"}>
			<Stack>
				<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
					<Suspense fallback={<Card>Lade Tabellendaten...</Card>}>
						{clubRankings?.map((rankings) => {
							if (!matchSeriesDisplayed.includes(rankings.matchSeries.allSeasonId)) {
								matchSeriesDisplayed.push(rankings.matchSeries.allSeasonId);
								return (
									<Suspense key={rankings.matchSeries.id} fallback={<Card>lade {rankings.matchSeries.name}..</Card>}>
										<RankingTable {...rankings} linkToTeamPage={true} />
									</Suspense>
								);
							}
						})}
					</Suspense>
				</SimpleGrid>
				<Suspense>
					{recentMatches && recentMatches.length > 0 && (
						<Card>
							<CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
							<CardSection>
								<Matches matches={recentMatches} type="past" />
							</CardSection>
						</Card>
					)}
				</Suspense>
			</Stack>
		</PageWithHeading>
	);
}

function NoRankingsData() {
	const currentMonth = new Date().getMonth() + 1;
	return (
		<PageWithHeading title="Tabelle">
			<Card>
				<CardTitle>Keine Daten gefunden</CardTitle>
				<Text>
					Tablleninformationen stehen aktuell nicht zur Verfügung. Eventuell liegt ein technisches Problem vor, oder es
					ist einfach der falsche Zeitpunkt.
				</Text>
			</Card>
			{currentMonth >= 4 && currentMonth <= 9 && (
				<Card>
					<CardTitle>Außerhalb der Saison?</CardTitle>
					<Text>
						Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt. Dazwischen
						und kurz vor Saisonbeginn, wurden die neusten Informationen vom Südbadischen Volleyballverband ggf. noch
						nicht veröffentlicht.
					</Text>
				</Card>
			)}
		</PageWithHeading>
	);
}
