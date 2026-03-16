import { Button, Card, Center, SimpleGrid, Text } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/bye")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Center m="xl" p="xl">
			<Card withBorder>
				<Text>Du hast dich erfolgreich ausgeloggt.</Text>
				<SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mt="md">
					<Button component={Link} to="/" variant="light">
						Zur Website
					</Button>
					<Button component={Link} to="/admin/otp-login">
						Zur Anmeldung
					</Button>
				</SimpleGrid>
			</Card>
		</Center>
	);
}
