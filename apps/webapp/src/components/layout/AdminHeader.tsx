import { AppShell, Avatar, Burger, Collapse, Container, Group, Menu, Stack, Title, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useState } from "react";
import type { AdminSessionUser } from "../../server/functions/session-utils";
import { authClient } from "../../lib/auth-client";
import { getAdminRoutesWithLabels } from "../../utils/adminNavLinks";

export const ADMIN_HEADER_HEIGHT = 60;

interface AdminHeaderProps {
	user?: AdminSessionUser;
}

export default function AdminHeader({ user }: AdminHeaderProps) {
	const [opened, { toggle, close }] = useDisclosure();
	const { location } = useRouterState();
	const navLinks = getAdminRoutesWithLabels(user?.role === "Admin");
	const navigate = useNavigate();
	const [loggingOut, setLoggingOut] = useState(false);

	const logout = async () => {
		setLoggingOut(true);
		await authClient.signOut();
		await navigate({ to: "/admin/login" });
	};

	return (
		<AppShell.Header c="white" bg="onyx">
			<Container size="xl" p="sm">
				<Group justify="space-between" h="100%">
					<UnstyledButton component={Link} to="/admin" onClick={close}>
						<Group gap="xs">
							<LayoutDashboard size={22} />
							<Title order={1} size="h2" fw={500} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
								Admin
							</Title>
						</Group>
					</UnstyledButton>
					<Group gap="sm" visibleFrom="sm" wrap="nowrap">
						{navLinks.map(({ to, label }) => {
							const isActive = location.pathname.startsWith(to);
							return (
								<UnstyledButton key={to} component={Link} to={to} c={isActive ? "turquoise.3" : "white"} fw={isActive ? 700 : 500} style={{ whiteSpace: "nowrap" }}>
									{label}
								</UnstyledButton>
							);
						})}
					</Group>
					<Group gap="xs">
						<Menu position="bottom-end">
							<Menu.Target>
								<Avatar name={user?.name} color="turquoise" variant="filled" style={{ cursor: "pointer" }} />
							</Menu.Target>
							<Menu.Dropdown>
								{user?.email && <Menu.Label>{user.email}</Menu.Label>}
								{user?.role && <Menu.Label>{user.role}</Menu.Label>}
								<Menu.Divider />
								<Menu.Item leftSection={<LogOut size={16} />} onClick={logout} disabled={loggingOut}>
									Abmelden
								</Menu.Item>
							</Menu.Dropdown>
						</Menu>
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" color="white" />
					</Group>
				</Group>
			</Container>
			<Collapse in={opened} hiddenFrom="sm" bg="onyx" p="md">
				<Stack gap="xs">
					{navLinks.map(({ to, label, icon }) => {
						const isActive = location.pathname.startsWith(to);
						return (
							<UnstyledButton key={to} component={Link} to={to} onClick={close} c={isActive ? "turquoise.3" : "white"} fw={isActive ? 700 : 500} w="100%">
								<Group gap="xs">
									{icon}
									{label}
								</Group>
							</UnstyledButton>
						);
					})}
				</Stack>
			</Collapse>
		</AppShell.Header>
	);
}
