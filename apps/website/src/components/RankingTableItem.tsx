import { Group, TableTd, TableTr, Text } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Ranking } from "@/data/sams/sams-server-actions";

type RankingTableItem = {
	team: NonNullable<Ranking["teams"]>[number];
	isHighlighted?: boolean;
	teamLink?: string | null;
	clubLogo: ReactNode;
};

export default function RankingTableItem({ team, isHighlighted, teamLink, clubLogo }: RankingTableItem) {
	const navigate = useNavigate();

	return (
		<TableTr
			data-team-uuid={team.uuid}
			data-team-name={team.teamName}
			bg={isHighlighted ? "onyx" : undefined}
			c={isHighlighted ? "white" : undefined}
			style={{ cursor: teamLink ? "pointer" : undefined }}
			onClick={() => {
				if (teamLink) navigate({ to: teamLink });
			}}
		>
			<TableTd ta="center">{team.rank}</TableTd>
			<TableTd>
				<Group wrap="nowrap" gap={4}>
					{clubLogo}
					<Text lineClamp={1}>{team.teamName}</Text>
				</Group>
			</TableTd>
			<TableTd ta="center">
				<Text size="sm">
					{team.wins}/{team.matchesPlayed}
				</Text>
			</TableTd>
			<TableTd ta="center" visibleFrom="sm">
				<Text size="sm">
					{team.setWins}:{team.setLosses}
				</Text>
			</TableTd>
			<TableTd ta="center">
				<Text size="sm">{team.points}</Text>
			</TableTd>
		</TableTr>
	);
}
