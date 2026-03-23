import { ActionIcon, Button, Card, Flex, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { getAdminRoutesWithLabels } from "@webapp/utils/adminNavLinks";
import { ArrowRight, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/_layout/")({
	component: DashboardIndexPage,
});

const adminLayoutRoute = getRouteApi("/admin/_layout");

function DashboardIndexPage() {
	const { user } = adminLayoutRoute.useRouteContext();

	return (
		<Stack gap="lg">
			<Text c="dimmed" size="sm">
				Die folgenden Bereiche stehen zur Verwaltung der Inhalte auf der Webseite zur Verfügung:
			</Text>

			<SimpleGrid spacing="md" cols={{ base: 1, sm: 2, xl: 3 }}>
				{getAdminRoutesWithLabels(user?.role === "Admin").map(({ to, label, icon, description }) => {
					return (
						<Card key={to} component={Link} to={to} withBorder radius="md" p="lg" shadow="xs" style={{ height: "100%", textDecoration: "none" }}>
							<Card.Section withBorder inheritPadding py="sm" mb="md">
								<Group gap="sm" wrap="nowrap">
									<ThemeIcon size="lg" color="blumine" variant="light">
										{icon}
									</ThemeIcon>
									<Text c="blumine" fw="bold" size="sm" truncate>
										{label}
									</Text>
								</Group>
							</Card.Section>

							<Flex justify="space-between" gap="xs">
								<Text size="sm" style={{ textWrap: "balance" }}>
									{description}
								</Text>
								<ActionIcon component="span" tabIndex={-1} aria-hidden="true" variant="transparent" color="blumine" display="inline-block">
									<ArrowRight size={16} />
								</ActionIcon>
							</Flex>
						</Card>
					);
				})}
			</SimpleGrid>
			<Group justify="center" m="xl">
				<Button rightSection={<ExternalLink size={16} />} component={Link} to="/" target="_blank">
					Zur Homepage
				</Button>
			</Group>
		</Stack>
	);
}
