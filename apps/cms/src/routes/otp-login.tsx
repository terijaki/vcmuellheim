import { Alert, Button, Center, Loader, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/otp-login")({
	validateSearch: z.object({
		email: z.email(),
		otp: z.coerce.number<number>().positive(),
	}),
	component: OtpLoginPage,
});

function OtpLoginPage() {
	const { email, otp } = Route.useSearch();
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		console.debug("Attempting OTP login with email:", email, "and otp:", otp);
		let isCancelled = false;

		const completeLogin = async () => {
			if (!email || !otp) {
				setError("Der Anmeldelink ist unvollständig.");
				return;
			}

			const result = await authClient.signIn.emailOtp({ email, otp: String(otp) });
			if (isCancelled) {
				return;
			}

			if (result.error) {
				setError("Der Anmeldelink ist ungültig oder abgelaufen.");
				return;
			}

			window.location.href = "/dashboard";
		};

		void completeLogin();

		return () => {
			isCancelled = true;
		};
	}, [email, otp]);

	return (
		<Center h="100vh">
			<Stack gap="md" w={420} p="xl">
				<Title order={2} ta="center">
					Anmeldung wird abgeschlossen
				</Title>

				{error ? (
					<>
						<Alert color="red" variant="light">
							{error}
						</Alert>
						<Text c="dimmed" ta="center" size="sm">
							Bitte fordere auf der Login-Seite einen neuen Code an.
						</Text>
						<Button component={Link} to="/dashboard" fullWidth>
							Zur Anmeldung
						</Button>
					</>
				) : (
					<>
						<Text c="dimmed" ta="center" size="sm">
							Du wirst automatisch ins CMS eingeloggt.
						</Text>
						<Center>
							<Loader />
						</Center>
					</>
				)}
			</Stack>
		</Center>
	);
}
