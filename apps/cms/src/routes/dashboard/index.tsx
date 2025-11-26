import { Button, Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Stack>
			<Title order={2}>Willkommen im VCM CMS</Title>
			<Text c="dimmed">Hier kannst du den Inhalte der Webseite editieren.</Text>
			<SimpleGrid cols={{ xs: 1, md: 2, lg: 3 }} spacing="md">
					<Link to="/dashboard/news">
				<Card>
					<Text size="lg">News</Text>
					<Text>Du kannst hier die neuesten Nachrichten verwalten.</Text>
					<Button>News verwalten</Button>
				</Card>
					</Link>
			</SimpleGrid>
		</Stack>
	);
}
