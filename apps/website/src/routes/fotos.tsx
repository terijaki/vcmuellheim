import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/fotos")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/fotos"!</div>;
}
