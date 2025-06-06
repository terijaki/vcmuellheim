import CardTitle from "@/components/CardTitle";
import Matches from "@/components/Matches";
import RankingTable from "@/components/RankingTable";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { samsClubRankings, samsLeagueMatches } from "@/data/sams/sams-server-actions";
import { getTeams } from "@/data/teams";
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
	const teamContext = teams?.docs?.map((t) => {
		const teamUuid = typeof t.sbvvTeam === "object" ? t.sbvvTeam?.uuid : null;
		return { teamUuid, slug: t.slug };
	});

	const lastResultCap = Math.max(6, Math.min(20, Number((teamSize * GAMES_PER_TEAM).toFixed(0)))); // calculate the total number of games to display based on the number of teams
	const numToWordsDe = require("num-words-de");
	// const recentMatches = await samsClubMatches({ past: true, limit: lastResultCap });
	const leagueMatches = await samsLeagueMatches({ limit: lastResultCap });
	const recentMatches = leagueMatches?.matches || [];
	const lastResultWord = recentMatches.length > 1 && numToWordsDe.numToWord(recentMatches.length, { uppercase: false });

	return (
		<PageWithHeading title={"Tabelle"}>
			<Stack>
				<SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
					<Suspense fallback={<Card>Lade Tabellendaten...</Card>}>
						{clubRankings?.map((ranking) => {
							return (
								<Suspense key={ranking.leagueUuid} fallback={<Card>lade Tabelle..</Card>}>
									<RankingTable ranking={ranking} linkToTeamPage={true} teams={teamContext} />
								</Suspense>
							);
						})}
					</Suspense>
				</SimpleGrid>
				<Suspense>
					{recentMatches && recentMatches.length > 0 && (
						<Card>
							<CardTitle>Unsere letzten {lastResultWord} Spiele</CardTitle>
							<CardSection p={{ base: undefined, sm: "sm" }}>
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
