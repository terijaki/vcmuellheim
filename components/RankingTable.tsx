import type { Ranking } from "@/data/sams/sams-server-actions";
import { SAMS } from "@/project.config";
import { Card, Group, Table, TableTbody, TableTh, TableThead, TableTr, Text } from "@mantine/core";
import dayjs from "dayjs";
import CardTitle from "./CardTitle";
import ClubLogo, { ClubLogoFallback } from "./ClubLogo";
import RankingTableItem from "./RankingTableItem";
import { Suspense } from "react";

type RankingTable = {
	ranking: Ranking;
	linkToTeamPage?: boolean;
	teams?: { teamUuid?: string | null; slug?: string | null }[];
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
						<LastUpdate date={ranking.timestamp.toISOString()} />
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
					{ranking.teams?.map(async (team) => {
						const isClubTeam = Boolean(team.teamName?.includes(SAMS.name));
						const teamInContext = props.teams?.find((t) => t.teamUuid === team.uuid);

						const isHighlighted = Boolean(teamInContext?.teamUuid) || Boolean(isClubTeam && props.linkToTeamPage);
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
