import { Alert, Button, Center, Loader, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getCurrentAdminUser } from "../../lib/admin-session";
import { authClient } from "../../lib/auth-client";

const otpSearchSchema = z.union([z.string().regex(/^\d{1,6}$/), z.coerce.number().int().min(0).max(999999)]).transform((value) => String(value).padStart(6, "0"));

export const Route = createFileRoute("/admin/otp-login")({
	validateSearch: z.object({
		email: z.email().optional(),
		otp: otpSearchSchema.optional(),
	}),
	beforeLoad: async () => {
		const user = await getCurrentAdminUser();
		if (user) {
			throw redirect({ to: "/admin/dashboard", replace: true });
		}
	},
	component: OtpLoginPage,
});

function OtpLoginPage() {
	const navigate = useNavigate();
	const { email, otp } = Route.useSearch();
	const [error, setError] = useState<string | null>(null);
	const hasCompleteParams = Boolean(email && otp);

	useEffect(() => {
		if (!hasCompleteParams) {
			return;
		}

		let isCancelled = false;

		const completeLogin = async () => {
			const result = await authClient.signIn.emailOtp({ email: email as string, otp: String(otp) });
			if (isCancelled) return;

			if (result.error) {
				setError("Der Anmeldelink ist ungültig oder abgelaufen.");
				return;
			}

			await navigate({ to: "/admin/dashboard" });
		};

		void completeLogin();
		return () => {
			isCancelled = true;
		};
	}, [email, hasCompleteParams, navigate, otp]);

	if (!hasCompleteParams) {
		return (
			<Center h="100vh">
				<Stack gap="md" w={360} p="xl" align="center">
					<Title order={2} ta="center">
						Anmeldung
					</Title>
					<Alert color="red" variant="light">
						Der Anmeldelink ist unvollständig.
					</Alert>
					<Button component={Link} to="/admin/login" variant="subtle">
						Zurück zur Anmeldung
					</Button>
				</Stack>
			</Center>
		);
	}

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
