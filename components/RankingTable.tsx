import { Club } from "@/project.config";
import { Card, Group, Table, TableTbody, TableTd, TableTh, TableThead, TableTr, Text } from "@mantine/core";
import dayjs from "dayjs";
import { Suspense } from "react";
import type { Rankings } from "sams-rpc";
import CardTitle from "./CardTitle";
import ClubLogo, { ClubLogoFallback } from "./ClubLogo";

type RankingTable = Rankings & {
	linkToTeamPage?: boolean;
	seasonTeamId?: string | null;
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
						//TODO link to team page if its a club team
						// if seasonTeamId then only this specific

						// href={`/teams/${team.team.id}`}

						return (
							<TableTr key={team.team.id} data-team-id={team.team.id} data-team-name={team.team.name}>
								<TableTd ta="center">{team.place}</TableTd>
								<TableTd>
									<Group wrap="nowrap" gap={4}>
										<Suspense fallback={<ClubLogoFallback className="mr-1" />}>
											<ClubLogo clubName={clubName} />
										</Suspense>
										<Text lineClamp={1}>{team.team.name}</Text>
									</Group>
								</TableTd>
								<TableTd ta="center">
									<Text size="sm">
										{team.wins}/{team.matchesPlayed}
									</Text>
								</TableTd>
								<TableTd ta="center" visibleFrom="sm">
									<Text size="sm">{team.setPoints}</Text>
								</TableTd>
								<TableTd ta="center">
									<Text size="sm">{team.points}</Text>
								</TableTd>
							</TableTr>
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
