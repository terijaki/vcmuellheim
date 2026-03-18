import { AspectRatio, BackgroundImage, Card, Group, SimpleGrid, Stack, Title, Typography } from "@mantine/core";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { getAdminRoutesWithLabels } from "../../../../utils/adminNavLinks";

export const Route = createFileRoute("/admin/_layout/dashboard/")({
	component: DashboardIndexPage,
});

const adminDashboardRoute = getRouteApi("/admin/_layout");

function DashboardIndexPage() {
	const { user } = adminDashboardRoute.useRouteContext();

	return (
		<SimpleGrid spacing="md" cols={{ base: 1, sm: 2, xl: 3 }}>
			{getAdminRoutesWithLabels(user?.role === "Admin").map(({ to, label, icon, description, image }) => {
				return (
					<Card key={to} component={Link} to={to} withBorder radius="md" bg="blumine" c="white">
						<Card.Section bg="turquoise" mb="md">
							<AspectRatio ratio={6 / 1}>
								<BackgroundImage src={image} opacity={0.9}>
									<Group gap="sm" p="md">
										{icon}
										<Title fw="bold" size="h2" c="white" style={{ textShadow: "1px 1px 2px black" }}>
											{label}
										</Title>
									</Group>
								</BackgroundImage>
							</AspectRatio>
						</Card.Section>
						<Stack align="stretch" justify="space-between" flex={1}>
							<Typography>{description}</Typography>
						</Stack>
					</Card>
				)
			})}
		</SimpleGrid>
	)
}
