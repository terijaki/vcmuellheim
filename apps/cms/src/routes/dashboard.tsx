import { AppShell, Burger, Button, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "../auth/AuthContext";

function DashboardLayout() {
	const { isAuthenticated, user, logout } = useAuth();
	const [opened, { toggle }] = useDisclosure();

	if (!isAuthenticated) {
		return <Navigate to="/login" />;
	}

	return (
		<AppShell header={{ height: 60 }} navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }} padding="md">
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
							Abmelden
						</Button>
					</Group>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<NavLink label="Übersicht" component={Link} to="/dashboard" />
				<NavLink label="News" component={Link} to="/dashboard/news" />
				<NavLink label="Termine" component={Link} to="/dashboard/events" />
				<NavLink label="Mannschaften" component={Link} to="/dashboard/teams" />
				<NavLink label="Mitglieder" component={Link} to="/dashboard/members" />
				<NavLink label="Orte" component={Link} to="/dashboard/locations" />
				<NavLink label="Medien" component={Link} to="/dashboard/media" />
				<NavLink label="Sponsoren" component={Link} to="/dashboard/sponsors" />
				<NavLink label="Bus Buchungen" component={Link} to="/dashboard/bus" />
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
