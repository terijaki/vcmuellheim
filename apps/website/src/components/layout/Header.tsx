import { AppShell, Burger, Collapse, Container, Group, Stack, Title, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import { FaVolleyball as Logo } from "react-icons/fa6";
import { Club } from "../../../../../project.config";
import { navbarLinks } from "../../utils/navbarLinks";
import Socials from "../layout/Socials";

export const HEADER_HEIGHT = 60;

export default function Header() {
	const [opened, { toggle, close }] = useDisclosure();

	return (
		<AppShell.Header c="white" bg="onyx">
			<Container size="xl" p="sm">
				<Group justify="space-between" h="100%">
					<UnstyledButton component={Link} href="/" onClick={close}>
						<Group gap="xs">
							<Logo size={24} />
							<Title order={1} size="h2" fw={500} tt="uppercase" style={{ letterSpacing: "0.1em" }}>
								{Club.shortName}
							</Title>
						</Group>
					</UnstyledButton>
					<Group gap="md" visibleFrom="sm">
						{navbarLinks.map((item) => (
							<UnstyledButton
								key={item.name}
								component={Link}
								{...item}
								c="white"
								fw={500}
								style={{
									"&:hover": {
										color: "var(--mantine-color-lion-6)",
									},
								}}
							>
								{item.name}
							</UnstyledButton>
						))}
					</Group>
					<Burger opened={opened} onClick={toggle} hiddenFrom="sm" color="white" />
				</Group>
			</Container>
			<Collapse in={opened} hiddenFrom="sm" bg="onyx" p="md">
				<Group justify="space-between" align="flex-start" pt="lg">
					<Stack gap="xs">
						{navbarLinks.map((item) => (
							<UnstyledButton
								key={item.name}
								component={Link}
								{...item}
								onClick={close}
								w="100%"
								style={{
									borderRadius: "var(--mantine-radius-sm)",
									"&:hover": {
										backgroundColor: "var(--mantine-color-gray-1)",
									},
								}}
							>
								{item.name}
							</UnstyledButton>
						))}
					</Stack>
					<Stack gap="xs">
						{Socials().map((socialItem) => (
							<UnstyledButton
								key={socialItem.name}
								component={Link}
								{...socialItem}
								onClick={close}
								w="100%"
								style={{
									borderRadius: "var(--mantine-radius-sm)",
									"&:hover": {
										backgroundColor: "var(--mantine-color-gray-1)",
									},
								}}
							>
								<Group gap="xs">
									{socialItem.icon}
									{socialItem.name}
								</Group>
							</UnstyledButton>
						))}
					</Stack>
				</Group>
			</Collapse>
		</AppShell.Header>
	);
}
