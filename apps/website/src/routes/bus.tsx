import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/bus")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/bus"!</div>;
}
