import { AppShell, AppShellMain, Container } from "@mantine/core";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import AdminHeader, { ADMIN_HEADER_HEIGHT } from "@webapp/components/layout/AdminHeader";
import { getCurrentAdminUser } from "@webapp/lib/admin-session";

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
	component: AdminLayout,
});

function AdminLayout() {
	const { user } = Route.useRouteContext();
	return (
		<AppShell header={{ height: ADMIN_HEADER_HEIGHT, offset: true }} withBorder={false} bg="aquahaze">
			<AdminHeader isAdmin={user?.role === "Admin"} userName={user?.name} userEmail={user?.email} />
			<AppShellMain>
				<Container size="xl" py="md" px={{ base: "lg", md: "xl" }}>
					<Outlet />
				</Container>
			</AppShellMain>
		</AppShell>
	);
}
