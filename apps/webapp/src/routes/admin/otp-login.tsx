import { Alert, Button, Center, Loader, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authClient } from "../../lib/auth-client";

export const Route = createFileRoute("/admin/otp-login")({
	validateSearch: z.object({
		email: z.email(),
		otp: z.coerce.number().positive(),
	}),
	component: OtpLoginPage,
});

function OtpLoginPage() {
	const { email, otp } = Route.useSearch();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isCancelled = false;

		const completeLogin = async () => {
			if (!email || !otp) {
				setError("Der Anmeldelink ist unvollständig.");
				return;
			}

			const result = await authClient.signIn.emailOtp({ email, otp: String(otp) });
			if (isCancelled) return;

			if (result.error) {
				setError("Der Anmeldelink ist ungültig oder abgelaufen.");
				return;
			}

			window.location.href = "/admin/dashboard";
		};

		void completeLogin();
		return () => {
			isCancelled = true;
		};
	}, [email, otp]);

	return (
		<Center h="100vh">
			<Stack gap="md" w={360} p="xl" align="center">
				<Title order={2} ta="center">
					Anmelden...
				</Title>
				{error ? (
					<>
						<Alert color="red" variant="light">
							{error}
						</Alert>
						<Button component={Link} to="/admin/login" variant="subtle">
							Zurück zur Anmeldung
						</Button>
					</>
				) : (
					<Loader />
				)}
				<Text c="dimmed" size="sm" ta="center">
					Du wirst nach erfolgreicher Anmeldung weitergeleitet.
				</Text>
			</Stack>
		</Center>
	);
}
