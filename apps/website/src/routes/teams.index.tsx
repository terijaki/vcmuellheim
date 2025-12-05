import { Center, Loader, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeTeamGrid from "../components/homepage/HomeTeamGrid";
import PageWithHeading from "../components/layout/PageWithHeading";
import { useTeams } from "../lib/hooks";

export const Route = createFileRoute("/teams/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { data, isLoading, error } = useTeams();
	const teams = data?.items || [];

	if (error) {
		throw error;
	}
	return (
		<PageWithHeading title="Mannschaften" description="Erfahre mehr über unsere Volleyball-Teams und Mannschaften bei Volleyballclub Müllheim">
			{isLoading && <Loader />}
			{teams && (
				<>
					<Center>
						<Text>
							Zurzeit umfasst unser Verein {teams.length} {teams.length > 1 ? "Mannschaften" : "Mannschaft"}:
						</Text>
					</Center>
					{teams && <HomeTeamGrid teams={teams} />}
				</>
			)}
		</PageWithHeading>
	);
}
