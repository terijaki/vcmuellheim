import { Box, Center, Container, Skeleton, Stack, Text } from "@mantine/core";
import * as numToWordsDe from "num-words-de";
import { useTeams } from "../../lib/hooks";
import SectionHeading from "../layout/SectionHeading";
import HomeTeamGrid from "./HomeTeamGrid";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeTeams() {
	const { data, isLoading } = useTeams();
	const teams = data?.items;

	const numberOfTeams = teams?.length || 0;
	// turn number to equivalent word, eg. 2 = zwei
	const teamNumber = numToWordsDe.numToWord(numberOfTeams, {
		uppercase: false,
		indefinite_eine: true,
	});

	const hasTeamResults = !!teams && teams.length > 0;

	return (
		<Box bg="aquahaze">
			<ScrollAnchor name="mannschaften" />
			<Container size="xl" py="xl" px={{ base: "lg", md: "xl" }}>
				<Stack>
					<Stack gap={0}>
						<SectionHeading text="Mannschaften" />
						{isLoading && (
							<Stack>
								<Skeleton visible height={120} />
								<Skeleton visible height={80} />
								<Skeleton visible height={80} />
							</Stack>
						)}

						{hasTeamResults && (
							<Center>
								<Text>
									Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
								</Text>
							</Center>
						)}
						{!isLoading && !hasTeamResults && (
							<Center>
								<Text>Mannschaften konnten nicht geladen werden.</Text>
							</Center>
						)}
					</Stack>
					{hasTeamResults && <HomeTeamGrid teams={teams} />}
				</Stack>
			</Container>
		</Box>
	);
}
