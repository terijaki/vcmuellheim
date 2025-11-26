import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/jugendschutz")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/jugendschutz"!</div>;
}
