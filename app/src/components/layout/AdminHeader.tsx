import { AppShell, Avatar, Burger, Collapse, Container, Group, Menu, Stack, Title, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { FaVolleyball } from "react-icons/fa6";
import { authClient } from "../../lib/auth-client";
import type { AdminSessionUser } from "../../server/functions/session-utils";
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
							<FaVolleyball size={24} />
							<Title hiddenFrom="md" order={1} size="h2" fw={500} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
								VCM Admin
							</Title>
							<Title visibleFrom="md" hiddenFrom="lg" order={1} size="h2" fw={500} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
								VCM
							</Title>
							<Title visibleFrom="lg" order={1} size="h2" fw={500} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
								VCM Admin
							</Title>
						</Group>
					</UnstyledButton>
					<Group>
						<Group gap="sm" visibleFrom="md" wrap="nowrap">
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
									<Avatar name={user?.name} variant="transparent" style={{ cursor: "pointer" }} />
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
							<Burger opened={opened} onClick={toggle} hiddenFrom="md" color="white" />
						</Group>
					</Group>
				</Group>
			</Container>
			<Collapse in={opened} hiddenFrom="md" bg="onyx" p="md">
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
