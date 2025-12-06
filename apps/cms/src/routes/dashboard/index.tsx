import { AspectRatio, BackgroundImage, Card, Group, SimpleGrid, Stack, Title, Typography } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "../../auth/AuthContext";
import { getDashboardRoutesWithLabels } from "../../utils/nav-links";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardIndexPage,
});

function DashboardIndexPage() {
	const { user } = useAuth();

	return (
		<SimpleGrid spacing="md" cols={{ base: 1, sm: 2, xl: 3 }}>
			{getDashboardRoutesWithLabels(user?.role === "Admin").map(([{ to, label, icon, description, image }]) => {
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
				);
			})}
		</SimpleGrid>
	);
}
