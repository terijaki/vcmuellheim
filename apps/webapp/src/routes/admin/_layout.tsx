/**
 * Admin layout route — applies the CMS AppShell sidebar to all protected admin pages.
 * Authentication is enforced at the route level before the layout renders.
 */

import { AppShell, Avatar, Burger, Center, Group, Loader, Menu, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { getCurrentAdminUser } from "../../lib/admin-session";
import { authClient } from "../../lib/auth-client";
import { getAdminRoutesWithLabels } from "../../utils/adminNavLinks";

export const Route = createFileRoute("/admin/_layout")({
	beforeLoad: async () => {
		const user = await getCurrentAdminUser();

		if (!user) {
			throw redirect({ to: "/admin" });
		}

		return { user };
	},
	pendingComponent: () => (
		<Center h="100vh">
			<Loader />
		</Center>
	),
	component: AdminShell,
});

function AdminShell() {
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();
	const [opened, { toggle }] = useDisclosure();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	const logout = async () => {
		setIsLoggingOut(true);
		await authClient.signOut();
		await navigate({ to: "/admin", replace: true });
	};

	if (isLoggingOut) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}

	return (
		<AppShell
			header={{ height: 60 }}
			navbar={{
				width: 250,
				breakpoint: "md",
				collapsed: { mobile: !opened },
			}}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group style={{ cursor: "pointer" }}>
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
						<Text size="lg" fw={700} hiddenFrom="sm" component="a" onClick={toggle}>
							VCM
						</Text>
						<Text size="lg" fw={700} visibleFrom="sm" component={Link} to="/admin/dashboard">
							Volleyballclub Müllheim e.V.
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
							<Menu.Item onClick={() => void logout()} leftSection={<LogOut size={16} />}>
								Abmelden
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				{getAdminRoutesWithLabels(user?.role === "Admin").map(({ to, label, icon }) => (
					<NavLink key={to} label={label} leftSection={icon} component={Link} to={to} onClick={toggle} style={{ fontWeight: 500 }} />
				))}
			</AppShell.Navbar>

			<AppShell.Main>
				<Outlet />
			</AppShell.Main>
		</AppShell>
	);
}
