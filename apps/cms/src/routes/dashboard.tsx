import { AppShell, Burger, Button, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { BadgeEuro, Bus, CalendarDays, Contact, Image, MapPinned, Newspaper, Users } from "lucide-react";
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
							Volleyballclub Müllheim e.V.
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
				<NavLink label="News" leftSection={<Newspaper />} component={Link} to="/dashboard/news" />
				<NavLink label="Termine" leftSection={<CalendarDays />} component={Link} to="/dashboard/events" />
				<NavLink label="Mannschaften" leftSection={<Users />} component={Link} to="/dashboard/teams" />
				<NavLink label="Mitglieder" leftSection={<Contact />} component={Link} to="/dashboard/members" />
				<NavLink label="Orte" leftSection={<MapPinned />} component={Link} to="/dashboard/locations" />
				<NavLink label="Medien" leftSection={<Image />} component={Link} to="/dashboard/media" />
				<NavLink label="Sponsoren" leftSection={<BadgeEuro />} component={Link} to="/dashboard/sponsors" />
				<NavLink label="Bus Buchungen" leftSection={<Bus />} component={Link} to="/dashboard/bus" />
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
