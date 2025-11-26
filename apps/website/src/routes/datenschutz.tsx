import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/datenschutz")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/datenschutz"!</div>;
}
