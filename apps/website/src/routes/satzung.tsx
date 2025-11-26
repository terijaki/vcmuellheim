import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/satzung")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/satzung"!</div>;
}
