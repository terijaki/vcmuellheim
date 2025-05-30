"use client";
import type { Team } from "@/data/payload-types";
import { Checkbox, Grid, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { Fragment, useState } from "react";
import TeamCard from "../TeamCard";
import { TeamContext } from "./HomeTeamContext";

export default function HomeTeamGrid({ teams }: { teams: Team[] }) {
	const [gender, setGender] = useState<string>("");
	const [leagueParticipation, setLeagueParticipation] = useState(false);

	const teamsSorted = gender
		? teams.sort((a, b) => {
				// sort by gender and league
				if (a.gender === gender && b.gender !== gender && (!leagueParticipation || a.league)) return -1;
				if (b.gender === gender && a.gender !== gender && (!leagueParticipation || b.league)) return 1;
				return 0;
			})
		: teams;

	return (
		<TeamContext value={{ gender, leagueParticipation }}>
			<Stack gap="xs" justify="center">
				<Group justify="center">
					<Text size="sm" fw="bold">
						Filter:
					</Text>
					<SegmentedControl
						onChange={(value) => setGender(value)}
						value={gender}
						data={[
							{ label: "Männlich", value: "men" },
							{ label: "Weiblich", value: "woman" },
							{ label: "Gemischt", value: "mixed" },
						]}
						color="blumine"
						bg="white"
					/>
					<Checkbox
						label="Nur Ligabetrieb"
						checked={leagueParticipation}
						onChange={() => setLeagueParticipation(!leagueParticipation)}
					/>
				</Group>
				<Grid gutter="md">
					{teamsSorted.map((team, index, array) => {
						const gridColSpan = { base: 12, sm: 12 / 2, lg: 12 / 3 };
						const matchingLeagueParticipation = leagueParticipation ? Boolean(team.sbvvTeam) : true;
						const matchingGender = team.gender === gender;
						const lastSelectedTeam = Boolean(
							matchingLeagueParticipation && matchingGender && array[index + 1].gender !== gender,
						);

						return (
							<Fragment key={team.id}>
								<Grid.Col span={gridColSpan}>
									<TeamCard {...team} />
								</Grid.Col>
								{lastSelectedTeam && <Grid.Col span={12} />}
							</Fragment>
						);
					})}
				</Grid>
			</Stack>
		</TeamContext>
	);
}
