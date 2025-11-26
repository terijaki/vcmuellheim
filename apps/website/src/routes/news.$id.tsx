import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/news/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/news/$id"!</div>;
}
