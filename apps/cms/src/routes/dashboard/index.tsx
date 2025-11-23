import { Stack, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Stack>
			<Title order={2}>Willkommen im VCM CMS</Title>
			<Text c="dimmed">Wählen Sie einen Menüpunkt aus der Seitenleiste.</Text>
		</Stack>
	);
}
