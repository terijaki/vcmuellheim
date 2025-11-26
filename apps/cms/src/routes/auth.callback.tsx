import { Alert, Container, Loader, Paper, Text } from "@mantine/core";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

function CallbackPage() {
	const { handleCallback, isAuthenticated, configLoaded } = useAuth();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(true);
	const hasProcessed = useRef(false);

	useEffect(() => {
		// Wait for config to load before processing callback
		if (!configLoaded) {
			return;
		}

		// Prevent double processing in React strict mode
		if (hasProcessed.current) {
			return;
		}
		hasProcessed.current = true;

		const processCallback = async () => {
			// Get code and state from URL
			const params = new URLSearchParams(window.location.search);
			const code = params.get("code");
			const state = params.get("state");
			const errorParam = params.get("error");

			if (errorParam) {
				setError(`Authentication error: ${errorParam}`);
				setIsProcessing(false);
				return;
			}

			if (!code) {
				setError("No authorization code received");
				setIsProcessing(false);
				return;
			}

			if (!state) {
				setError("No state parameter received");
				setIsProcessing(false);
				return;
			}

			try {
				await handleCallback(code, state);
				// Success - navigate to dashboard
				navigate({ to: "/dashboard" });
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "Authentication failed";
				setError(errorMessage);
			} finally {
				setIsProcessing(false);
			}
		};

		processCallback();
	}, [configLoaded, handleCallback, navigate]);

	// If already authenticated, redirect to dashboard
	if (isAuthenticated && !isProcessing) {
		return <Navigate to="/dashboard" />;
	}

	return (
		<Container size="xs" style={{ marginTop: "5rem" }}>
			<Paper withBorder shadow="md" p={30} radius="md">
				{isProcessing ? (
					<>
						<Loader mx="auto" mb="md" />
						<Text ta="center">Authentifizierung läuft...</Text>
					</>
				) : error ? (
					<>
						<Alert color="red" mb="md">
							{error}
						</Alert>
						<Text ta="center">
							<a href="/login">Zurück zur Anmeldung</a>
						</Text>
					</>
				) : null}
			</Paper>
		</Container>
	);
}

export const Route = createFileRoute("/auth/callback")({
	component: CallbackPage,
});
