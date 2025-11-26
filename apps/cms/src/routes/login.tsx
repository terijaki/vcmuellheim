import { Alert, Container, Loader, Paper, Text } from "@mantine/core";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";

function LoginPage() {
	const { redirectToLogin, isAuthenticated, configLoaded, error } = useAuth();

	// Redirect authenticated users to dashboard
	if (isAuthenticated) {
		return <Navigate to="/dashboard" />;
	}

	// Auto-redirect to Cognito login once config is loaded
	useEffect(() => {
		if (configLoaded && !isAuthenticated) {
			redirectToLogin();
		}
	}, [configLoaded, isAuthenticated, redirectToLogin]);

	return (
		<Container size="xs" style={{ marginTop: "5rem" }}>
			<Paper withBorder shadow="md" p={30} radius="md">
				{error ? (
					<>
						<Alert color="red" mb="md">
							{error}
						</Alert>
						<Text ta="center" size="sm" c="dimmed">
							Bitte laden Sie die Seite neu oder kontaktieren Sie den Support.
						</Text>
					</>
				) : (
					<>
						<Loader mx="auto" mb="md" />
						<Text ta="center">Weiterleitung zur Anmeldung...</Text>
					</>
				)}
			</Paper>
		</Container>
	);
}

export const Route = createFileRoute("/login")({
	component: LoginPage,
});
