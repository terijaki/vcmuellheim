import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/members")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/dashboard/members"!</div>;
}
