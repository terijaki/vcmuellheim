import { createFileRoute, Navigate, Outlet, Link } from "@tanstack/react-router";
import { AppShell, Burger, Group, NavLink, Text, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuth } from "../auth/AuthContext";

function DashboardLayout() {
	const { isAuthenticated, user, logout } = useAuth();
	const [opened, { toggle }] = useDisclosure();

	if (!isAuthenticated) {
		return <Navigate to="/login" />;
	}

	return (
		<AppShell
			header={{ height: 60 }}
			navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group>
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
						<Text size="lg" fw={700}>
							VCM CMS
						</Text>
					</Group>
					<Group>
						<Text size="sm">{user?.email}</Text>
						<Button variant="subtle" onClick={logout} size="sm">
							Logout
						</Button>
					</Group>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<NavLink label="Dashboard" component={Link} to="/dashboard" />
				<NavLink label="News" component={Link} to="/dashboard/news" />
				<NavLink label="Events" component={Link} to="/dashboard/events" />
				<NavLink label="Teams" component={Link} to="/dashboard/teams" />
				<NavLink label="Members" component={Link} to="/dashboard/members" />
				<NavLink label="Media" component={Link} to="/dashboard/media" />
				<NavLink label="Sponsors" component={Link} to="/dashboard/sponsors" />
				<NavLink label="Bus Schedules" component={Link} to="/dashboard/bus" />
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}

export const Route = createFileRoute("/dashboard")({
	component: DashboardLayout,
});
