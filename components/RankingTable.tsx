import { Club } from "@/project.config";
import { Card, Group, Table, TableTbody, TableTh, TableThead, TableTr, Text } from "@mantine/core";
import dayjs from "dayjs";
import { Suspense } from "react";
import type { Rankings } from "sams-rpc";
import CardTitle from "./CardTitle";
import ClubLogo, { ClubLogoFallback } from "./ClubLogo";
import RankingTableItem from "./RankingTableItem";

type RankingTable = Rankings & {
	linkToTeamPage?: boolean;
	teams?: { seasonTeamId?: string | null; slug?: string | null }[];
};

export default function RankingTable(props: RankingTable) {
	const ranking = props.ranking;

	if (!ranking) return null;

	return (
		<Card>
			<CardTitle>{props.matchSeries.name}</CardTitle>
			<Group c="dimmed" justify="space-between">
				<Text size="xs">Saison {props.matchSeries.season.name}</Text>
				{props.matchSeries.updated && (
					<Text size="xs">
						<LastUpdate date={props.matchSeries.updated} />
					</Text>
				)}
			</Group>
			<Table striped highlightOnHover withRowBorders={false} horizontalSpacing="xs" verticalSpacing={0}>
				<TableThead>
					<TableTr>
						<TableTh>
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
					{ranking.map(async (team) => {
						const clubName = team.team.club;
						const isClubTeam = clubName === Club.shortName || false;
						const teamInContext = props.teams?.find((t) => t.seasonTeamId === team.team.id);

						const isHighlighted = Boolean(teamInContext?.seasonTeamId) || Boolean(isClubTeam && props.linkToTeamPage);
						const teamLink = teamInContext?.slug ? `/teams/${teamInContext.slug}` : null;

						return (
							<RankingTableItem
								key={team.team.id}
								ranking={team}
								isHighlighted={isHighlighted}
								teamLink={teamLink}
								clubLogo={
									<Suspense fallback={<ClubLogoFallback className="mr-1" />}>
										<ClubLogo clubName={clubName} light={isHighlighted} />
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
