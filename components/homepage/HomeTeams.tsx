import SectionHeading from "@/components/layout/SectionHeading";
import { getTeams } from "@/data/teams";
import { Box, Center, Container, Group, Text } from "@mantine/core";
import TeamCard from "../TeamCard";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeTeams() {
	const data = await getTeams();
	const teams = data?.docs;
	if (!teams) return null;

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
			<Container size="xl">
				<SectionHeading text="Mannschaften" />
				<Center>
					<Text>
						Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
					</Text>
				</Center>
				<Group gap="md" py="xl" grow wrap="wrap" align="flex-start" justify="center">
					{teams.map((team) => (
						<TeamCard {...team} key={team.id} />
					))}
				</Group>
			</Container>
		</Box>
	);
}
