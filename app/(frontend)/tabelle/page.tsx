import CardTitle from "@/components/CardTitle";
import PageHeading from "@/components/layout/PageHeading";
import PageWithHeading from "@/components/layout/PageWithHeading";
import Matches from "@/components/sams/Matches";
import RankingTable from "@/components/sams/RankingTable";
import { samsClubData, samsClubMatches, samsClubRankings } from "@/utils/sams/sams-server-actions";
import { Card, CardSection, SimpleGrid, Stack } from "@mantine/core";
import type { Metadata } from "next";
import { Suspense } from "react";

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export const metadata: Metadata = { title: "Tabelle" };

export default async function Tabelle() {
	const clubData = await samsClubData();
	if (!clubData) return <NoRankingsData />;
	const clubRankings = await samsClubRankings();
	if (!clubRankings || clubRankings.length === 0) return <NoRankingsData />;

	const teamSize = clubData?.teams?.team.length || 0;
	const lastResultCap = Math.min(20, Number((teamSize * GAMES_PER_TEAM).toFixed(0))); // calculate the total number of games
	const numToWordsDe = require("num-words-de");
	const recentMatches = await samsClubMatches({ past: true, limit: lastResultCap });
	const lastResultWord =
		recentMatches && recentMatches.length > 1 && numToWordsDe.numToWord(recentMatches.length, { uppercase: false });

	const matchSeriesDisplayed: string[] = []; //placeholder to avoid duplicate league displays
	return (
		<PageWithHeading title={"Tabelle"}>
			<Stack>
				<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
					{clubRankings == null && <div>Lade Tabellendaten...</div>}
					<Suspense>
						{clubRankings?.map((rankings) => {
							if (!matchSeriesDisplayed.includes(rankings.matchSeries.uuid)) {
								matchSeriesDisplayed.push(rankings.matchSeries.uuid);
								return (
									<Suspense
										fallback={
											<div className="card-narrow p-6 flex justify-center place-items-center">
												lade {rankings.matchSeries.name}..
											</div>
										}
										key={rankings.matchSeries.id}
									>
										<RankingTable {...rankings} linkToTeamPage={true} clubData={clubData} />
									</Suspense>
								);
							}
						})}
					</Suspense>
				</SimpleGrid>
				{recentMatches && recentMatches.length > 0 && (
					<Card>
						<CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
						<CardSection>
							<Matches matches={recentMatches} type="past" />
						</CardSection>
					</Card>
				)}
			</Stack>
		</PageWithHeading>
	);
}

function NoRankingsData() {
	const currentMonth = new Date().getMonth() + 1;
	return (
		<>
			<PageHeading title="Tabelle" />

			<div className="col-center-content card my-6">
				<h2 className="card-heading">Keine Daten gefunden</h2>
				<p>
					Tablleninformationen stehen aktuell nicht zur Verfügung. Eventuell liegt ein technisches Problem vor, oder es
					ist einfach der falsche Zeitpunkt.
				</p>
			</div>
			{currentMonth >= 4 && currentMonth <= 9 ? (
				<div className="col-center-content card mb-6">
					<h2 className="card-heading">Außerhalb der Saison?</h2>
					<p className="mt-3">
						Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt. Dazwischen
						und kurz vor Saisonbeginn, wurden die neusten Informationen vom Südbadischen Volleyballverband ggf. noch
						nicht veröffentlicht.
					</p>
				</div>
			) : (
				""
			)}
		</>
	);
}
