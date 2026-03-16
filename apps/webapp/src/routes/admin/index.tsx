import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentAdminUser } from "../../lib/admin-session";

export const Route = createFileRoute("/admin/")({
	beforeLoad: async () => {
		const user = await getCurrentAdminUser();

		throw redirect({
			to: user ? "/admin/dashboard" : "/admin/otp-login",
		});
	},
	pendingComponent: () => null,
	component: () => null,
});
