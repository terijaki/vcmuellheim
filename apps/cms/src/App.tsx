import { Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import { useAuth } from "./auth/AuthContext";

export function App() {
	const { user, login, logout, isLoading, error } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			await login(username, password);
		} catch {
			// Error is handled in AuthContext
		}
	};

	if (user) {
		return (
			<Container size="md" py="xl">
				<Paper shadow="sm" p="xl" withBorder>
					<Title order={1} mb="md">
						VCM CMS
					</Title>
					<Text mb="md">Welcome, {user.email || user.username}!</Text>
					<Button onClick={logout}>Logout</Button>
				</Paper>
			</Container>
		);
	}

	return (
		<Container size="xs" py="xl">
			<Paper shadow="sm" p="xl" withBorder>
				<Title order={1} mb="md">
					VCM CMS Login
				</Title>
				<form onSubmit={handleLogin}>
					<Stack>
						<TextInput label="Email" type="email" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={isLoading} />
						<PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
						{error && (
							<Text c="red" size="sm">
								{error}
							</Text>
						)}
						<Button type="submit" loading={isLoading}>
							Login
						</Button>
					</Stack>
				</form>
			</Paper>
		</Container>
	);
}
