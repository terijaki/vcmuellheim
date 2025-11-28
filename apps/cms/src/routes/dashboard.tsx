import { AppShell, Avatar, Burger, Group, Menu, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BadgeEuro, Building2, Bus, CalendarDays, Contact, LogOut, MapPinned, Newspaper, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

function DashboardLayout() {
	const { user, logout } = useAuth();
	const [opened, { toggle }] = useDisclosure();

	return (
		<AppShell header={{ height: 60 }} navbar={{ width: 250, breakpoint: "md", collapsed: { mobile: !opened } }} padding="md">
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
							<Menu.Item onClick={logout} leftSection={<LogOut size={16} />}>
								Abmelden
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<NavLink label="News" leftSection={<Newspaper />} component={Link} to="/dashboard/news" onClick={toggle} />
				<NavLink label="Termine" leftSection={<CalendarDays />} component={Link} to="/dashboard/events" onClick={toggle} />
				<NavLink label="Mannschaften" leftSection={<Users />} component={Link} to="/dashboard/teams" onClick={toggle} />
				<NavLink label="Mitglieder" leftSection={<Contact />} component={Link} to="/dashboard/members" onClick={toggle} />
				<NavLink label="Orte" leftSection={<MapPinned />} component={Link} to="/dashboard/locations" onClick={toggle} />
				<NavLink label="Sponsoren" leftSection={<BadgeEuro />} component={Link} to="/dashboard/sponsors" onClick={toggle} />
				<NavLink label="Bus Buchungen" leftSection={<Bus />} component={Link} to="/dashboard/bus" onClick={toggle} />
				<NavLink label="SAMS" leftSection={<Building2 />} component={Link} to="/dashboard/sams" onClick={toggle} />
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
