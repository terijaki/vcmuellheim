import { Center, Loader, Stack, Text, Title } from "@mantine/core";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: () => <Outlet />,
	errorComponent: ({ error }) => {
		return (
			<Stack h="100vh" w="100vw" align="center" justify="center" gap="md">
				<Title>Fehler</Title>
				<Text>{String(error)}</Text>
			</Stack>
		);
	},
	notFoundComponent: () => {
		return (
			<Stack h="100vh" w="100vw" align="center" justify="center" gap="md">
				<Title>404</Title>
				<Text>Seite nicht gefunden</Text>
			</Stack>
		);
	},
	pendingComponent: () => {
		return (
			<Center h="100vh" w="100vw">
				<Loader />
			</Center>
		);
	},
});
