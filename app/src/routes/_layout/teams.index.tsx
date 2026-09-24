import { Center, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import HomeTeamGrid from "@webapp/components/homepage/HomeTeamGrid";
import PageWithHeading from "@webapp/components/layout/PageWithHeading";
import { getHomeMembersFn } from "@webapp/server/functions/members";
import { listTeamsFn } from "@webapp/server/functions/teams";

export const Route = createFileRoute("/_layout/teams/")({
  loader: async () => {
    const [data, members] = await Promise.all([listTeamsFn(), getHomeMembersFn()]);
    return { teams: data.items, members };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { teams, members } = Route.useLoaderData();
  return (
    <PageWithHeading
      title="Mannschaften"
      description="Erfahre mehr über unsere Volleyball-Teams und Mannschaften bei Volleyballclub Müllheim"
    >
      <Center>
        <Text>
          Zurzeit umfasst unser Verein {teams.length}{" "}
          {teams.length > 1 ? "Mannschaften" : "Mannschaft"}:
        </Text>
      </Center>
      <HomeTeamGrid teams={teams} initialMembers={members} />
    </PageWithHeading>
  );
}
