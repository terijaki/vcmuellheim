import React from "react";
import { getTeamIds, getUniqueMatchSeriesIds } from "@/app/utils/sams/jsonClubData";
import { getRankings } from "@/app/utils/sams/jsonRanking";
import RankingTable from "@/app/components/sams/RankingTable";
import PageHeading from "@/app/components/layout/PageHeading";
import Matches from "@/app/components/sams/Matches";
import { getMatches } from "@/app/utils/sams/jsonMatches";

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata> {
	return {
		title: "Tabelle",
	};
}

const GAMES_PER_TEAM: number = 2.3; // maximum number of games per team to shown below the rankings

export default function Tabelle() {
	const lastResultCap = Number((getUniqueMatchSeriesIds(getTeamIds("id")).length * GAMES_PER_TEAM).toFixed(0)); // calculate the total number of games
	const numToWordsDe = require("num-words-de");
	const lastResultWord = numToWordsDe.numToWord(lastResultCap, { uppercase: false });

	const rankings = getRankings(getUniqueMatchSeriesIds(getTeamIds("id")));
	const matchCount = getMatches(getTeamIds("id"), "past").length;

	let matchSeriesDisplayed: string[] = []; //placeholder to avoid duplicate league displays
	if (rankings.length >= 1) {
		return (
			<>
				<PageHeading title="Tabelle" />
				<div className="col-full-content sm:col-center-content grid gap-y-8 md:gap-4 my-4 md:grid-cols-2 prose-h2:text-2xl">
					{rankings.map((ranking) => {
						if (!matchSeriesDisplayed.includes(ranking.matchSeries.uuid)) {
							matchSeriesDisplayed.push(ranking.matchSeries.uuid);
							return (
								<RankingTable
									{...ranking}
									key={ranking.matchSeries.id}
								/>
							);
						}
					})}
				</div>
				{lastResultCap > 0 && matchCount > 1 && (
					<div className="col-full-content sm:col-center-content card-narrow my-4 mb-8">
						<h2 className="card-heading">Unsere letzten {lastResultWord} Spiele</h2>
						<Matches
							teamId={getTeamIds("id")}
							filter="past"
							limit={lastResultCap}
						/>
					</div>
				)}
			</>
		);
	} else {
		let currentMonth = new Date().getMonth() + 1;

		return (
			<>
				<PageHeading title="Tabelle" />

				<div className="col-center-content card my-6">
					<h2 className="card-heading">Keine Daten gefunden</h2>
					<p>Tablleninformationen stehen aktuell nicht zur Verfügung. Eventuell liegt ein technisches Problem vor, oder es ist einfach der falsche Zeitpunkt.</p>
				</div>
				{currentMonth >= 1 && currentMonth <= 9 ? (
					<div className="col-center-content card mb-6">
						<h2 className="card-heading">Außerhalb der Saison?</h2>
						<p className="mt-3">
							Die Saison im Hallenvolleyball findet in der Regel in den Monaten von September bis April statt. Dazwischen und kurz vor Saisonbeginn, wurden die neusten Informationen vom Südbadischen
							Volleyballverband ggf. noch nicht veröffentlicht.
						</p>
					</div>
				) : (
					""
				)}
			</>
		);
	}
}
