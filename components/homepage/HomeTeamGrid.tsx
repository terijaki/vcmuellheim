"use client";
import type { Team } from "@/data/payload-types";
import { Checkbox, Flex, Grid, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { Fragment, useState } from "react";
import TeamCard from "../TeamCard";
import { TeamContext } from "./HomeTeamContext";

export default function HomeTeamGrid({ teams }: { teams: Team[] }) {
	const [gender, setGender] = useState<string>("");
	const [leagueParticipation, setLeagueParticipation] = useState(false);

	const teamsSorted = teams.sort((a, b) => {
		// sort by gender, league and name
		const aMatchesLeague = !leagueParticipation || Boolean(a.league);
		const bMatchesLeague = !leagueParticipation || Boolean(b.league);
		const aMatchesGender = gender === "" || gender === a.gender;
		const bMatchesGender = gender === "" || gender === b.gender;
		const aMatch = aMatchesLeague && aMatchesGender;
		const bMatch = bMatchesLeague && bMatchesGender;
		if (aMatch && !bMatch) return -1;
		if (!aMatch && bMatch) return 1;
		if (aMatch && bMatch) return a.name.localeCompare(b.name);
		return 0;
	});

	return (
		<TeamContext value={{ gender, leagueParticipation }}>
			<Stack gap="md" justify="center">
				<Group justify="center" align="center">
					<Text size="sm" fw="bold" visibleFrom="sm">
						Filter:
					</Text>
					<Flex gap="sm" wrap="wrap" justify="center" align="center">
						<SegmentedControl
							onChange={(value) => setGender(value)}
							value={gender}
							data={[
								{ label: "Keine", value: "" },
								{ label: "Weiblich", value: "woman" },
								{ label: "Männlich", value: "men" },
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
					</Flex>
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
