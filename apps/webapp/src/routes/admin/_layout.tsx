import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentAdminUser } from "../../lib/admin-session";

export const Route = createFileRoute("/admin/_layout")({
	beforeLoad: async ({ location }) => {
		const user = await getCurrentAdminUser();
		if (!user) {
			throw redirect({
				to: "/admin/login",
				search: { redirect: location.href },
				replace: true,
			});
		}
		return { user };
	},
	component: () => <Outlet />,
});
