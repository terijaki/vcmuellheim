import { createFileRoute } from "@tanstack/react-router";
import { useTeamContext } from "../components/context/HomeTeamContext";

export const Route = createFileRoute("/teams/$slug")({
	component: RouteComponent,
	context: () => useTeamContext(),
});

function RouteComponent() {
	return <div>Hello "/teams/$slug"!</div>;
}
