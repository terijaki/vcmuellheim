import PageHeading from "@/app/components/layout/PageHeading";
import Matches from "@/app/components/sams/Matches";
import RankingTable from "@/app/components/sams/RankingTable";
import type { Metadata } from "next";
import { Suspense } from "react";
import { samsClubData, samsClubMatches, samsClubRankings } from "../utils/sams/sams-server-actions";

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
		<>
			<PageHeading title={"Tabelle"} />
			<div className="col-full-content sm:col-center-content grid gap-y-8 md:gap-4 my-4 sm:grid-cols-1 lg:grid-cols-2 prose-h2:text-2xl">
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
			</div>
			{recentMatches && recentMatches.length > 0 && (
				<div className="col-full-content sm:col-center-content card-narrow-flex my-4 mb-8">
					<h2 className="card-heading">Unsere letzten {lastResultWord} Spiele</h2>
					<Matches matches={recentMatches} type="past" />
				</div>
			)}
		</>
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
