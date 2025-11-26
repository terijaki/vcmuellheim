import { Alert, Button, Container, Paper, Text, Title } from "@mantine/core";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "../auth/AuthContext";

function LoginPage() {
	const { redirectToLogin, isAuthenticated, error } = useAuth();

	// Redirect authenticated users to dashboard
	if (isAuthenticated) {
		return <Navigate to="/dashboard" />;
	}

	return (
		<Container size="xs" style={{ marginTop: "5rem" }}>
			<Paper withBorder shadow="md" p={30} radius="md">
				<Title order={2} mb="lg">
					CMS Anmeldung
				</Title>
				{error && (
					<Alert color="red" mb="md">
						{error}
					</Alert>
				)}
				<Text mb="md" ta="center">
					Melden Sie sich mit Ihrem AWS Cognito-Konto an.
				</Text>
				<Button onClick={redirectToLogin} fullWidth>
					Mit Cognito anmelden
				</Button>
			</Paper>
		</Container>
	);
}

export const Route = createFileRoute("/login")({
	component: LoginPage,
});
