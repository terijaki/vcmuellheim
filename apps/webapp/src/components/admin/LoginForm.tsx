import { Alert, Button, PinInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

export interface LoginFormProps {
	redirectTo?: "/admin/dashboard";
}

export function LoginForm({ redirectTo = "/admin/dashboard" }: LoginFormProps) {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [otpEmail, setOtpEmail] = useState<string | null>(null);
	const [info, setInfo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const sendCodeInfoMessage = "Wenn die E-Mail-Adresse registriert ist, wurde ein Anmeldecode verschickt.";

	const sendOtp = async (targetEmail: string) => {
		const normalizedEmail = targetEmail.trim().toLowerCase();
		await authClient.emailOtp.sendVerificationOtp({
			email: normalizedEmail,
			type: "sign-in",
		});
		return normalizedEmail;
	};

	const handleSendOtp = async () => {
		if (!email.trim()) return;
		setSubmitting(true);
		setError(null);
		setInfo(null);

		try {
			const normalizedEmail = await sendOtp(email);
			setOtp("");
			setOtpEmail(normalizedEmail);
			setOtpSent(true);
			setInfo(sendCodeInfoMessage);
		} catch {
			setError("Der Anmeldecode konnte gerade nicht angefordert werden. Bitte versuche es erneut.");
		}

		setSubmitting(false);
	};

	const handleVerifyOtp = async (otpValue = otp) => {
		if (!otpEmail || otpValue.length < 6) return;
		setSubmitting(true);
		setError(null);

		const result = await authClient.signIn.emailOtp({
			email: otpEmail,
			otp: otpValue,
		});

		if (result.error) {
			setError(result.error.message || "Ungültiger Code");
			setSubmitting(false);
			return;
		}

		await navigate({ to: redirectTo });
	};

	return (
		<Stack gap="md" w={360} p="xl">
			<Title order={2} ta="center">
				VC Müllheim Anmeldung
			</Title>

			{error && (
				<Alert color="red" variant="light">
					{error}
				</Alert>
			)}
			{info && (
				<Alert color="blue" variant="light">
					{info}
				</Alert>
			)}

			{!otpSent ? (
				<>
					<Text c="dimmed" ta="center" size="sm">
						Gib deine E-Mail-Adresse ein, um einen Anmeldecode zu erhalten.
					</Text>
					<TextInput
						label="E-Mail-Adresse"
						placeholder="erika@example.com"
						value={email}
						onChange={(event) => setEmail(event.currentTarget.value)}
						onKeyDown={(event) => event.key === "Enter" && void handleSendOtp()}
						type="email"
						disabled={submitting}
						autoFocus
					/>
					<Button onClick={() => void handleSendOtp()} loading={submitting} disabled={!email.trim()} fullWidth>
						Anmeldecode senden
					</Button>
				</>
			) : (
				<>
					<Text c="dimmed" ta="center" size="sm">
						Falls die Adresse registriert ist, wurde ein Anmeldecode an <strong>{otpEmail}</strong> gesendet. Bitte den 6-stelligen Code eingeben.
					</Text>
					<Stack align="center" gap="md">
						<PinInput
							length={6}
							type="number"
							value={otp}
							onChange={setOtp}
							onComplete={(value) => void handleVerifyOtp(value)}
							disabled={submitting}
							autoFocus
							oneTimeCode
							inputMode="numeric"
							ariaLabel="Anmeldecode"
						/>
					</Stack>
					<Button onClick={() => void handleVerifyOtp()} loading={submitting} disabled={otp.length < 6} fullWidth>
						Anmelden
					</Button>
					<Button
						variant="subtle"
						onClick={async () => {
							if (!otpEmail) return;

							setOtp("");
							setError(null);
							setInfo(null);
							setSubmitting(true);

							try {
								await sendOtp(otpEmail);
								setInfo(sendCodeInfoMessage);
							} catch {
								setError("Der Anmeldecode konnte gerade nicht angefordert werden.");
							}

							setSubmitting(false);
						}}
						disabled={submitting}
					>
						Code erneut anfordern
					</Button>
					<Button
						variant="subtle"
						color="gray"
						onClick={() => {
							setOtpSent(false);
							setOtp("");
							setError(null);
							setInfo(null);
							setEmail(otpEmail || "");
						}}
						disabled={submitting}
					>
						E-Mail-Adresse ändern
					</Button>
				</>
			)}
		</Stack>
	);
}
