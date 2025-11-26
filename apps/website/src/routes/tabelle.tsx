import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tabelle")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/tabelle"!</div>;
}
