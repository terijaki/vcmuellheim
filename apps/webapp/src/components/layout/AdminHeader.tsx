import { AppShell, Burger, Collapse, Container, Group, Stack, Title, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { getAdminRoutesWithLabels } from "../../utils/adminNavLinks";

export const ADMIN_HEADER_HEIGHT = 60;

export default function AdminHeader({ isAdmin }: { isAdmin: boolean }) {
	const [opened, { toggle, close }] = useDisclosure();
	const { location } = useRouterState();
	const navLinks = getAdminRoutesWithLabels(isAdmin);

	return (
		<AppShell.Header c="white" bg="blumine">
			<Container size="xl" p="sm">
				<Group justify="space-between" h="100%">
					<UnstyledButton component={Link} to="/admin/dashboard" onClick={close}>
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
					<Burger opened={opened} onClick={toggle} hiddenFrom="sm" color="white" />
				</Group>
			</Container>
			<Collapse in={opened} hiddenFrom="sm" bg="blumine" p="md">
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
