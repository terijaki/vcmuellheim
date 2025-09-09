"use client";
import { Checkbox, Divider, Flex, Grid, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { Fragment, useState } from "react";
import type { Team } from "@/data/payload-types";
import { TeamContext } from "../context/HomeTeamContext";
import TeamCard from "../TeamCard";

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
						<Checkbox label="Nur Ligabetrieb" checked={leagueParticipation} onChange={() => setLeagueParticipation(!leagueParticipation)} />
					</Flex>
				</Group>
				<Grid gutter="md">
					{teamsSorted.map((team, index, array) => {
						const isMatchingLeagueParticipation = leagueParticipation ? Boolean(team.league) : true;
						const isMatchingGender = team.gender === gender || gender === "";
						const isMatching = isMatchingLeagueParticipation && isMatchingGender;
						const nextTeam = array[index + 1];
						const nextIsMatchingLeagueParticipation = leagueParticipation ? Boolean(nextTeam?.league) : true;
						const nextIsMatchingGender = nextTeam?.gender === gender || gender === "";
						const nextIsMatching = nextIsMatchingLeagueParticipation && nextIsMatchingGender;

						const lastSelectedTeam = Boolean(isMatching && !nextIsMatching);

						return (
							<Fragment key={team.id}>
								<Grid.Col span={{ base: 12, sm: 12 / 2, lg: 12 / 3 }}>
									<TeamCard {...team} />
								</Grid.Col>
								{lastSelectedTeam && (
									<Grid.Col span={12}>
										<Divider size="sm" />
									</Grid.Col>
								)}
							</Fragment>
						);
					})}
				</Grid>
			</Stack>
		</TeamContext>
	);
}
