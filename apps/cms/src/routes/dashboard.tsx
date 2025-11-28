import { AppShell, Avatar, Burger, Group, Menu, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BadgeEuro, Building2, Bus, CalendarDays, Contact, LogOut, MapPinned, Newspaper, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

function DashboardLayout() {
	const { user, logout } = useAuth();
	const [opened, { toggle }] = useDisclosure();

	return (
		<AppShell header={{ height: 60 }} navbar={{ width: 250, breakpoint: "sm", collapsed: { mobile: !opened } }} padding="md">
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group>
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
						<Text size="lg" fw={700} visibleFrom="sm">
							Volleyballclub Müllheim e.V.
						</Text>
						<Text size="lg" fw={700} hiddenFrom="sm">
							VCM
						</Text>
					</Group>
					<Menu>
						<Menu.Target>
							<Avatar name={user?.name} color="blumine" variant="light" alt="User Avatar" />
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Label>{user?.name}</Menu.Label>
							<Menu.Label>{user?.email}</Menu.Label>
							<Menu.Divider />
							<Menu.Item onClick={logout} leftSection={<LogOut />}>
								Abmelden
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<NavLink label="News" leftSection={<Newspaper />} component={Link} to="/dashboard/news" />
				<NavLink label="Termine" leftSection={<CalendarDays />} component={Link} to="/dashboard/events" />
				<NavLink label="Mannschaften" leftSection={<Users />} component={Link} to="/dashboard/teams" />
				<NavLink label="Mitglieder" leftSection={<Contact />} component={Link} to="/dashboard/members" />
				<NavLink label="Orte" leftSection={<MapPinned />} component={Link} to="/dashboard/locations" />
				<NavLink label="Sponsoren" leftSection={<BadgeEuro />} component={Link} to="/dashboard/sponsors" />
				<NavLink label="Bus Buchungen" leftSection={<Bus />} component={Link} to="/dashboard/bus" />
				<NavLink label="SAMS" leftSection={<Building2 />} component={Link} to="/dashboard/sams" />
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}

export const Route = createFileRoute("/dashboard")({
	component: DashboardLayout,
	beforeLoad: ({ context }) => {
		if (!context.auth.isAuthenticated) {
			context.auth.redirectToLogin();
		}
	},
});
