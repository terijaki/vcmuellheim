import { Card, Group, Table, TableTbody, TableTh, TableThead, TableTr, Text } from "@mantine/core";
import dayjs from "dayjs";
import { Suspense } from "react";
import type { RankingResponse } from "@/lambda/sams/types";
import type { Team } from "@/lib/db";
import { SAMS } from "@/project.config";
import CardTitle from "./CardTitle";
import ClubLogo, { ClubLogoFallback } from "./ClubLogo";
import RankingTableItem from "./RankingTableItem";

type RankingTable = {
	ranking: RankingResponse;
	linkToTeamPage?: boolean;
	teams?: Team[];
};

export default function RankingTable(props: RankingTable) {
	const ranking = props.ranking;

	if (!ranking) return null;

	return (
		<Card>
			{props.ranking.leagueName && <CardTitle>{props.ranking.leagueName}</CardTitle>}
			<Group c="dimmed" justify="space-between">
				{props.ranking.seasonName && <Text size="xs">Saison {props.ranking.seasonName}</Text>}
				{ranking.timestamp && (
					<Text size="xs">
						<LastUpdate date={ranking.timestamp} />
					</Text>
				)}
			</Group>
			<Table striped highlightOnHover withRowBorders={false} horizontalSpacing="xs" verticalSpacing={0}>
				<TableThead>
					<TableTr>
						<TableTh ta="center">
							<Text fw="bold" hiddenFrom="sm">
								Nr
							</Text>
							<Text fw="bold" visibleFrom="sm">
								Platz
							</Text>
						</TableTh>
						<TableTh>
							<Text fw="bold">Mannschaft</Text>
						</TableTh>
						<TableTh ta="center">
							<Text fw="bold">Siege</Text>
						</TableTh>
						<TableTh ta="center" visibleFrom="sm">
							<Text fw="bold">Sätze</Text>
						</TableTh>
						<TableTh ta="center">
							<Text fw="bold" hiddenFrom="sm">
								Pkt
							</Text>
							<Text fw="bold" visibleFrom="sm">
								Punkte
							</Text>
						</TableTh>
					</TableTr>
				</TableThead>
				<TableTbody>
					{ranking.teams?.map(async (team) => {
						const isClubTeam = Boolean(team.teamName?.includes(SAMS.name));
						const teamInContext = props.teams?.find((t) => t.sbvvTeamId === team.uuid);

						const isHighlighted = Boolean(teamInContext?.sbvvTeamId) || Boolean(isClubTeam && props.linkToTeamPage);
						const teamLink = teamInContext?.slug ? `/teams/${teamInContext.slug}` : null;

						return (
							<RankingTableItem
								key={team.uuid}
								team={team}
								isHighlighted={isHighlighted}
								teamLink={teamLink}
								clubLogo={
									<Suspense fallback={<ClubLogoFallback />}>
										<ClubLogo teamName={team.teamName} light={isHighlighted} />
									</Suspense>
								}
							/>
						);
					})}
				</TableTbody>
			</Table>
		</Card>
	);
}

function LastUpdate({ date }: { date: string }) {
	const dateInput = dayjs(date);
	const dateDisplay = dateInput.format("DD.MM.YY");
	const dateTimeDisplay = dateInput.format("HH:mm");

	return (
		<>
			Stand <time dateTime={date.toString()}>{dateDisplay}</time> {dateTimeDisplay} Uhr
		</>
	);
}
