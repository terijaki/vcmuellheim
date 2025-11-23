import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Container, Paper, Title, TextInput, PasswordInput, Button, Alert } from "@mantine/core";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

function LoginPage() {
	const { login, isAuthenticated, error } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	if (isAuthenticated) {
		return <Navigate to="/dashboard" />;
	}

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		try {
			await login(username, password);
		} finally {
			setIsLoading(false);
		}
	};

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
					<form onSubmit={handleLogin}>
						<TextInput
							label="E-Mail"
							placeholder="ihre@email.de"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
							mb="md"
						/>
						<PasswordInput
							label="Passwort"
							placeholder="Ihr Passwort"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							mb="md"
						/>
						<Button type="submit" fullWidth loading={isLoading}>
							Anmelden
						</Button>
					</form>
				</Paper>
			</Container>
		);
	}export const Route = createFileRoute("/login")({
	component: LoginPage,
});
