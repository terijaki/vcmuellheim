import { Box, Center, Container, Stack, Text } from "@mantine/core";
import SectionHeading from "@/components/layout/SectionHeading";
import { getTeams } from "@/data/teams";
import HomeTeamGrid from "./HomeTeamGrid";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeTeams() {
	const data = await getTeams();
	const teams = data?.docs;
	if (!teams) return null;
	if (teams.length === 0) return null;

	const numberOfTeams = teams.length;
	// turn number to requivalent word, eg. 2 = zwei
	const numToWordsDe = require("num-words-de");
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
