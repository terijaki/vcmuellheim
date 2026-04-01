import { AppShell, AppShellMain, Container } from "@mantine/core";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import AdminHeader, { ADMIN_HEADER_HEIGHT } from "@webapp/components/layout/AdminHeader";
import { adminLayoutGuard } from "@webapp/lib/auth-guards";

export const Route = createFileRoute("/admin/_layout")({
	beforeLoad: ({ context, location }) => {
		return adminLayoutGuard(context.session, location.href);
	},
	component: AdminLayout,
});

function AdminLayout() {
	const { user } = Route.useRouteContext();
	return (
		<AppShell header={{ height: ADMIN_HEADER_HEIGHT, offset: true }} withBorder={false} bg="aquahaze">
			<AdminHeader user={user} />
			<AppShellMain>
				<Container size="xl" py="md" px={{ base: "lg", md: "xl" }}>
					<Outlet />
				</Container>
			</AppShellMain>
		</AppShell>
	);
}
