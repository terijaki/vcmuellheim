"use client";
import { Group, TableTd, TableTr, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Rankings } from "sams-rpc";

type RankingTableItem = {
	ranking: NonNullable<Rankings["ranking"]>[number];
	isHighlighted?: boolean;
	teamLink?: string | null;
	clubLogo: ReactNode;
};

export default function RankingTableItem({ ranking, isHighlighted, teamLink, clubLogo }: RankingTableItem) {
	const router = useRouter();

	return (
		<TableTr
			data-team-id={ranking.team.id}
			data-team-name={ranking.team.name}
			bg={isHighlighted ? "onyx" : undefined}
			c={isHighlighted ? "white" : undefined}
			style={{ cursor: teamLink ? "pointer" : undefined }}
			onClick={() => {
				if (teamLink) router.push(teamLink);
			}}
		>
			<TableTd ta="center">{ranking.place}</TableTd>
			<TableTd>
				<Group wrap="nowrap" gap={4}>
					{clubLogo}
					<Text lineClamp={1}>{ranking.team.name}</Text>
				</Group>
			</TableTd>
			<TableTd ta="center">
				<Text size="sm">
					{ranking.wins}/{ranking.matchesPlayed}
				</Text>
			</TableTd>
			<TableTd ta="center" visibleFrom="sm">
				<Text size="sm">{ranking.setPoints}</Text>
			</TableTd>
			<TableTd ta="center">
				<Text size="sm">{ranking.points}</Text>
			</TableTd>
		</TableTr>
	);
}
