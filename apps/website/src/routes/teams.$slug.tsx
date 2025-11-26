import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/teams/$slug")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/teams/$slug"!</div>;
}
