import { Center, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeTeamGrid from "@webapp/components/homepage/HomeTeamGrid";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import { listTeamsFn } from "@webapp/server/functions/teams";

export const Route = createFileRoute("/_layout/teams/")({
	loader: async () => {
		const data = await listTeamsFn();
		return { teams: data.items };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { teams } = Route.useLoaderData();
	return (
		<PageWithHeading title="Mannschaften" description="Erfahre mehr über unsere Volleyball-Teams und Mannschaften bei Volleyballclub Müllheim">
			<Center>
				<Text>
					Zurzeit umfasst unser Verein {teams.length} {teams.length > 1 ? "Mannschaften" : "Mannschaft"}:
				</Text>
			</Center>
			<HomeTeamGrid teams={teams} />
		</PageWithHeading>
	);
}
