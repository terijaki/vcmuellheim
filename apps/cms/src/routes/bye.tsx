import { Button, Card, Center, SimpleGrid, Text } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "../auth/AuthContext";

export const Route = createFileRoute("/bye")({
	component: RouteComponent,
});

function RouteComponent() {
	const { redirectToLogin } = useAuth();

	return (
		<Center m="xl" p="xl">
			<Card withBorder>
				<Text>Du hast dich erfolgreich ausgeloggt.</Text>
				<SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mt="md">
					<Button component="a" href="https://vcmuellheim.de" variant="light">
						Zur Website
					</Button>
					<Button onClick={() => redirectToLogin()}>Zur Anmeldung</Button>
				</SimpleGrid>
			</Card>
		</Center>
	);
}
