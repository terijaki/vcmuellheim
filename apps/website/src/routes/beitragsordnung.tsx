import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/beitragsordnung")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/beitragsordnung"!</div>;
}
