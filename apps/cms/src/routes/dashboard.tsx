import { AppShell, Avatar, Burger, Center, Group, Loader, Menu, NavLink, Stack, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BadgeEuro, Building2, Bus, CalendarDays, Contact, LogOut, MapPinned, Newspaper, UserCog, Users } from "lucide-react";
import { useEffect } from "react";
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
				{user?.role === "Admin" && <NavLink label="Benutzer" leftSection={<UserCog />} component={Link} to="/dashboard/users" onClick={toggle} />}
				<NavLink label="SAMS" leftSection={<Building2 />} component={Link} to="/dashboard/sams" onClick={toggle} />
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}

function DashboardPage() {
	const { isLoading, isAuthenticated, isLoggingOut, redirectToLogin, error } = useAuth();

	// Use effect to handle redirect outside of render cycle
	useEffect(() => {
		if (!isLoading && !isAuthenticated && !isLoggingOut) {
			redirectToLogin();
		}
	}, [isLoading, isAuthenticated, isLoggingOut, redirectToLogin]);

	// Still loading - show loader
	if (isLoading) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}
	if (error) throw error;

	// Logging out - don't redirect, let Cognito handle the logout
	if (isLoggingOut) {
		return null;
	}

	// Not authenticated - show nothing while redirect is happening
	if (!isAuthenticated) {
		return null;
	}

	// Authenticated - show dashboard
	return <DashboardLayout />;
}

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
	errorComponent: ({ error }) => {
		return (
			<Stack h="100vh" w="100vw" align="center" justify="center" gap="md">
				<Title>Fehler</Title>
				<Text>{String(error)}</Text>
			</Stack>
		);
	},
});
