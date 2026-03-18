import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentAdminUser } from "@webapp/lib/admin-session";

export const Route = createFileRoute("/admin/")({
	beforeLoad: async () => {
		const user = await getCurrentAdminUser();
		if (user) {
			throw redirect({ to: "/admin/dashboard", replace: true });
		}
		throw redirect({ to: "/admin/login", replace: true });
	},
});
