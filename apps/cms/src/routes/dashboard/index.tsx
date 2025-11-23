import { createFileRoute } from "@tanstack/react-router";
import { Title, Text, Stack } from "@mantine/core";

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
