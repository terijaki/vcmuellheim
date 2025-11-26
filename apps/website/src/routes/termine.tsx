import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termine")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/termine"!</div>;
}
