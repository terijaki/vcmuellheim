import { Box, Center, Container, Stack, Text } from "@mantine/core";
import * as numToWordsDe from "num-words-de";
import { useTeams } from "../../lib/hooks";
import SectionHeading from "../layout/SectionHeading";
import HomeTeamGrid from "./HomeTeamGrid";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeTeams() {
	const { data } = useTeams();
	const teams = data?.items;
	if (!teams) return null;
	if (teams.length === 0) return null;

	const numberOfTeams = teams.length;
	// turn number to equivalent word, eg. 2 = zwei
	const teamNumber = numToWordsDe.numToWord(numberOfTeams, {
		uppercase: false,
		indefinite_eine: true,
	});

	return (
		<Box bg="aquahaze">
			<ScrollAnchor name="mannschaften" />
			<Container size="xl" py="xl" px={{ base: "lg", md: "xl" }}>
				<Stack>
					<Stack gap={0}>
						<SectionHeading text="Mannschaften" />
						<Center>
							<Text>
								Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
							</Text>
						</Center>
					</Stack>
					<HomeTeamGrid teams={teams} />
				</Stack>
			</Container>
		</Box>
	);
}
