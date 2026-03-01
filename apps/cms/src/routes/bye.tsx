import { Button, Card, Center, SimpleGrid, Text } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/bye")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Center m="xl" p="xl">
			<Card withBorder>
				<Text>Du hast dich erfolgreich ausgeloggt.</Text>
				<SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mt="md">
					<Button component="a" href="https://vcmuellheim.de" variant="light">
						Zur Website
					</Button>
					<Button component={Link} to="/dashboard">
						Zur Anmeldung
					</Button>
				</SimpleGrid>
			</Card>
		</Center>
	);
}
